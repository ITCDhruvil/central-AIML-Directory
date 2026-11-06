import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";

/** Serves an uploaded media file to signed-in people, with Range support so video and audio can seek. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return new NextResponse(null, { status: 401 });
  const { id } = await params;

  const row = await prisma.mediaFile.findUnique({ where: { id }, select: { data: true, contentType: true, name: true } });
  if (!row) return new NextResponse(null, { status: 404 });

  const data = new Uint8Array(row.data);
  const headers: Record<string, string> = {
    "Content-Type": row.contentType,
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, max-age=86400, immutable",
    "Content-Disposition": "inline; filename*=UTF-8''" + encodeURIComponent(row.name),
  };

  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : data.length - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : data.length - 1;
    start = Math.max(0, start);
    end = Math.min(end, data.length - 1);
    if (start > end) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${data.length}` } });
    return new NextResponse(data.slice(start, end + 1), {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${data.length}`, "Content-Length": String(end - start + 1) },
    });
  }
  return new NextResponse(data, { headers: { ...headers, "Content-Length": String(data.length) } });
}
