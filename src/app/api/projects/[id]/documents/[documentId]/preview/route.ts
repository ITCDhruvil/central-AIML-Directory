import { apiAuthorize } from "@/lib/auth/dal";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDocumentationById } from "@/lib/documents";
import { buildPreview } from "@/lib/filePreview";
import { fileExtension } from "@/lib/uploadFile";

type RouteParams = { params: Promise<{ id: string; documentId: string }> };

/**
 * An in-app preview of an uploaded file as JSON: Excel / CSV as sheets, Markdown and plain text as text, Word as
 * HTML. `{ preview: null }` means this type has no preview and can only be downloaded.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await apiAuthorize("documents", "view");
  if (!auth.ok) return auth.response;

  const { id, documentId } = await params;

  // Same project-scoped lookup as the file route, so access follows the project.
  const document = await getDocumentationById(id, documentId, auth.access);
  if (!document?.file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const file = await prisma.documentFile.findUnique({ where: { documentId } });
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  try {
    const preview = await buildPreview(Buffer.from(file.data), fileExtension(file.fileName));
    return NextResponse.json({ preview }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("GET /api/projects/[id]/documents/[documentId]/preview failed", error);
    return NextResponse.json({ error: "This file could not be read for preview. You can still download it." }, { status: 422 });
  }
}
