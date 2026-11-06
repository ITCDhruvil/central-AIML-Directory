import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { cleanMediaName, mediaUrl, MAX_MEDIA_BYTES, sniffMedia, type MediaKind } from "@/lib/media";
import { prisma } from "@/lib/prisma";

/** Adds an image, video or audio file for use in a note. The type is read from the bytes, never trusted from the browser. */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_MEDIA_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "That file is too large (limit 25 MB)." }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
  if (file.size > MAX_MEDIA_BYTES) return NextResponse.json({ error: "That file is too large (limit 25 MB)." }, { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const hintRaw = form.get("kind");
  const hint = hintRaw === "audio" || hintRaw === "video" ? (hintRaw as MediaKind) : undefined;
  const found = sniffMedia(bytes, hint);
  if (!found) return NextResponse.json({ error: "Use a PNG, JPEG, GIF, WebP, MP4, WebM, MOV, MP3, WAV, OGG or M4A file." }, { status: 400 });

  try {
    const name = cleanMediaName(file.name);
    const row = await prisma.mediaFile.create({
      data: { userId: user.id, name, contentType: found.type, size: bytes.length, data: Buffer.from(bytes) },
      select: { id: true },
    });
    return NextResponse.json({ id: row.id, url: mediaUrl(row.id), kind: found.kind, name, type: found.type, size: bytes.length });
  } catch (error) {
    console.error("POST /api/media failed", error);
    return NextResponse.json({ error: "Could not save the file" }, { status: 500 });
  }
}
