import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { sniffAvatarType } from "@/lib/avatar";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * A person's profile picture. Any signed-in person may fetch it (it is shown next to names across the app); nobody else
 * can. The type is re-checked from the stored bytes before it is sent, and the response can't be treated as anything but
 * an image. Pictures are cached for a long time because the URL carries a version that changes with the picture.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const { id } = await params;
  const row = await prisma.userAvatar.findUnique({ where: { userId: id } });
  if (!row) return new NextResponse(null, { status: 404 });

  const bytes = new Uint8Array(row.data);
  const type = sniffAvatarType(bytes);
  if (!type) return new NextResponse(null, { status: 404 });

  const etag = `"${row.updatedAt.getTime()}"`;
  const headers: Record<string, string> = {
    ETag: etag,
    // "private": the picture is for signed-in people only, so shared caches must not keep it.
    "Cache-Control": request.nextUrl.searchParams.has("v") ? "private, max-age=31536000, immutable" : "private, max-age=300",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  };
  if (request.headers.get("if-none-match") === etag) return new NextResponse(null, { status: 304, headers });

  return new NextResponse(bytes, { headers: { ...headers, "Content-Type": type, "Content-Length": String(bytes.byteLength) } });
}
