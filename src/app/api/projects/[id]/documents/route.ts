import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toDocumentation } from "@/lib/documentMapper";
import { listDocumentation } from "@/lib/documents";
import { recordProjectActivity } from "@/lib/projectActivity";
import { getProjectById } from "@/lib/projects";
import { uniqueManualFilePath } from "@/lib/manualDocuments";
import { ValidationError, validateManualDocumentInput } from "@/lib/validation";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    const documents = await listDocumentation(id);
    return NextResponse.json({ documents });
  } catch (error) {
    console.error("GET /api/projects/[id]/documents failed", error);
    return NextResponse.json({ error: "Failed to load documentation" }, { status: 500 });
  }
}

/** Creates a manually-authored document. GitHub/generated documents are never created through this endpoint. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const project = await getProjectById(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const input = validateManualDocumentInput(body);
    const filePath = await uniqueManualFilePath(id, input.title);

    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.documentation.create({
        data: {
          projectId: id,
          title: input.title,
          category: input.category,
          filePath,
          content: input.content,
          source: "manual",
        },
      });
      await recordProjectActivity(tx, id, "DOCUMENTATION_UPDATED", `Added documentation “${created.title}”`);
      return created;
    });

    return NextResponse.json({ document: toDocumentation(row) }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    console.error("POST /api/projects/[id]/documents failed", error);
    return NextResponse.json({ error: "Failed to create document" }, { status: 500 });
  }
}
