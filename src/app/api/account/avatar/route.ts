import { NextRequest, NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/dal";
import { MAX_AVATAR_BYTES, validateAvatar } from "@/lib/avatar";
import { prisma } from "@/lib/prisma";

// A little headroom over the picture itself, for the request's own overhead.
const MAX_BODY_BYTES = MAX_AVATAR_BYTES + 1024;

async function currentUser() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "Authentication required" }, { status: 401 }) } as const;
  if (user.mustChangePassword) return { error: NextResponse.json({ error: "Password change required" }, { status: 403 }) } as const;
  return { user } as const;
}

/**
 * Sets the signed-in person's own profile picture. The body is the image itself (the browser has already cropped it
 * square and shrunk it). The type is read from the bytes, never from what the browser says it is.
 */
export async function PUT(request: NextRequest) {
  const auth = await currentUser();
  if ("error" in auth) return auth.error;

  // Refuse an obviously oversized upload before reading it.
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "That picture is too large." }, { status: 413 });
  }

  const bytes = new Uint8Array(await request.arrayBuffer());
  const checked = validateAvatar(bytes);
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: checked.error.includes("too large") ? 413 : 400 });

  try {
    const row = await prisma.userAvatar.upsert({
      where: { userId: auth.user.id },
      create: { userId: auth.user.id, data: Buffer.from(bytes), contentType: checked.type },
      update: { data: Buffer.from(bytes), contentType: checked.type },
      select: { updatedAt: true },
    });
    await audit({ action: "user.avatar_changed", actorId: auth.user.id, entityType: "user", entityId: auth.user.id, meta: { removed: false }, request });
    return NextResponse.json({ ok: true, version: row.updatedAt.getTime() });
  } catch (error) {
    console.error("PUT /api/account/avatar failed", error);
    return NextResponse.json({ error: "Could not save the picture" }, { status: 500 });
  }
}

/** Removes the signed-in person's picture; their initials show again. */
export async function DELETE(request: NextRequest) {
  const auth = await currentUser();
  if ("error" in auth) return auth.error;

  try {
    const removed = await prisma.userAvatar.deleteMany({ where: { userId: auth.user.id } });
    if (removed.count > 0) {
      await audit({ action: "user.avatar_changed", actorId: auth.user.id, entityType: "user", entityId: auth.user.id, meta: { removed: true }, request });
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("DELETE /api/account/avatar failed", error);
    return NextResponse.json({ error: "Could not remove the picture" }, { status: 500 });
  }
}
