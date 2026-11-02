import { apiAuthorize } from "@/lib/auth/dal";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDocumentationById } from "@/lib/documents";
import { isInlineSafe } from "@/lib/uploadFile";

type RouteParams = { params: Promise<{ id: string; documentId: string }> };

/** Sends an uploaded file. A download by default; `?inline=1` shows PDFs and images in place and nothing else. */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await apiAuthorize("documents", "view");
  if (!auth.ok) return auth.response;

  const { id, documentId } = await params;

  // Same project-scoped lookup as the page and the other document routes, so access follows the project.
  const document = await getDocumentationById(id, documentId, auth.access);
  if (!document?.file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const file = await prisma.documentFile.findUnique({ where: { documentId } });
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const inline = request.nextUrl.searchParams.get("inline") === "1" && isInlineSafe(file.contentType);
  const disposition = inline ? "inline" : "attachment";

  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      "Content-Type": inline ? file.contentType : "application/octet-stream",
      "Content-Length": String(file.size),
      "Content-Disposition": `${disposition}; filename="${encodeURIComponent(file.fileName)}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
