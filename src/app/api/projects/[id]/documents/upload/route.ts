import { audit } from "@/lib/audit";
import { indexDocumentById } from "@/lib/rag/indexer";
import { apiAuthorize } from "@/lib/auth/dal";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateTitle } from "@/lib/github/documents";
import { recordProjectActivity } from "@/lib/projectActivity";
import { getProjectById } from "@/lib/projects";
import { uniqueUploadFilePath } from "@/lib/manualDocuments";
import { cleanFileName, formatFileSize, MAX_UPLOAD_BYTES } from "@/lib/uploadFile";
import { MAX_MANUAL_DOCUMENT_TITLE_LENGTH, UPLOAD_SOURCE } from "@/types/documentation";

type RouteParams = { params: Promise<{ id: string }> };

/** Stores any file as a project document. Text/Markdown files are better added through the JSON endpoint, which keeps them editable. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await apiAuthorize("documents", "create");
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const project = await getProjectById(id, auth.access);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected a file upload." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was sent." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "The file is empty." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `The file is too large (limit is ${formatFileSize(MAX_UPLOAD_BYTES)}).` },
      { status: 413 },
    );
  }

  try {
    const fileName = cleanFileName(file.name);
    const data = Buffer.from(await file.arrayBuffer());
    const filePath = await uniqueUploadFilePath(id, fileName);
    // The extension is shown separately (as a PDF/size tag), so it stays out of the title.
    const title = generateTitle(fileName.replace(/\.[^.]+$/, "")).slice(0, MAX_MANUAL_DOCUMENT_TITLE_LENGTH) || fileName;

    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.documentation.create({
        data: {
          projectId: id,
          title,
          category: "OTHER",
          filePath,
          content: "",
          source: UPLOAD_SOURCE,
          file: {
            create: { fileName, contentType: file.type || "application/octet-stream", size: data.length, data },
          },
        },
      });
      await recordProjectActivity(tx, id, "DOCUMENTATION_UPDATED", `Uploaded “${fileName}”`);
      return created;
    });

    await audit({ action: "document.uploaded", actorId: auth.user.id, entityType: "document", entityId: row.id, meta: { title, projectId: id }, request });
    // Best-effort: index this document for the project RAG. Never fails the request.
    await indexDocumentById(row.id).catch(() => {});
    return NextResponse.json({ document: { id: row.id, title } }, { status: 201 });
  } catch (error) {
    console.error("POST /api/projects/[id]/documents/upload failed", error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
