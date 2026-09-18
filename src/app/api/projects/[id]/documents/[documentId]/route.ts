import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toDocumentation } from "@/lib/documentMapper";
import { getDocumentationById } from "@/lib/documents";
import { isDeletableDocument, isEditableDocument } from "@/lib/documentOwnership";
import { recordProjectActivity } from "@/lib/projectActivity";
import { ValidationError, validateManualDocumentInput } from "@/lib/validation";

type RouteParams = { params: Promise<{ id: string; documentId: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id, documentId } = await params;

  try {
    const document = await getDocumentationById(id, documentId);
    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    return NextResponse.json({ document });
  } catch (error) {
    console.error("GET /api/projects/[id]/documents/[documentId] failed", error);
    return NextResponse.json({ error: "Failed to load document" }, { status: 500 });
  }
}

/** Edits a manually-created document. GitHub-sourced and generated documents are never editable here. */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id, documentId } = await params;

  // Scoped to (projectId, documentId) together — a document from another
  // project can never be reached through this route, regardless of what the
  // client sends.
  const existing = await getDocumentationById(id, documentId);
  if (!existing) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  if (!isEditableDocument(existing.source)) {
    return NextResponse.json({ error: "This document is read-only and cannot be edited." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const input = validateManualDocumentInput(body);
    const row = await prisma.$transaction(async (tx) => {
      const updated = await tx.documentation.update({
        where: { id: documentId },
        data: { title: input.title, category: input.category, content: input.content },
      });
      await recordProjectActivity(tx, id, "DOCUMENTATION_UPDATED", `Updated documentation “${updated.title}”`);
      return updated;
    });
    return NextResponse.json({ document: toDocumentation(row) });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    console.error("PUT /api/projects/[id]/documents/[documentId] failed", error);
    return NextResponse.json({ error: "Failed to update document" }, { status: 500 });
  }
}

/** Deletes a manually-created document. GitHub-sourced and generated documents cannot be deleted here. */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id, documentId } = await params;

  const existing = await getDocumentationById(id, documentId);
  if (!existing) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  if (!isDeletableDocument(existing.source)) {
    return NextResponse.json({ error: "This document cannot be deleted." }, { status: 403 });
  }

  try {
    await prisma.documentation.delete({ where: { id: documentId } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("DELETE /api/projects/[id]/documents/[documentId] failed", error);
    return NextResponse.json({ error: "Failed to delete document" }, { status: 500 });
  }
}
