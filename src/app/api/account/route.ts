import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";

/** The signed-in person's own profile. Anyone can change their own display name; nothing else here is editable. */
export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (user.mustChangePassword) return NextResponse.json({ error: "Password change required" }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const raw = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const name = typeof raw.name === "string" ? raw.name.trim().replace(/\s+/g, " ") : "";
  if (name.length < 1 || name.length > 80) {
    return NextResponse.json({ error: "Name must be 1–80 characters." }, { status: 400 });
  }

  try {
    await prisma.user.update({ where: { id: user.id }, data: { name } });
    return NextResponse.json({ ok: true, name });
  } catch (error) {
    console.error("PATCH /api/account failed", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
