import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toIdea } from "@/lib/ideaMapper";
import { toProject } from "@/lib/projectMapper";
import { searchPortfolio } from "@/lib/search/search";
import type { SearchableDocument } from "@/lib/search/types";
import type { DocumentCategory } from "@/types/documentation";

/**
 * Global search across project metadata, ideas, and documentation content.
 * Deterministic, server-side, no external services. Fetches minimal columns
 * only — full document content never reaches the browser, only computed
 * snippets do.
 */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";

  if (!query.trim()) {
    return NextResponse.json({ query: "", projects: [], ideas: [], documentation: [] });
  }

  try {
    const [projectRows, ideaRows, documentRows] = await Promise.all([
      prisma.project.findMany(),
      prisma.idea.findMany(),
      prisma.documentation.findMany({
        select: { id: true, projectId: true, title: true, category: true, content: true },
      }),
    ]);

    const projects = projectRows.map(toProject);
    const ideas = ideaRows.map(toIdea);
    const documents: SearchableDocument[] = documentRows.map((row) => ({
      id: row.id,
      projectId: row.projectId,
      title: row.title,
      category: row.category as DocumentCategory,
      content: row.content,
    }));

    const result = searchPortfolio(query, projects, documents, ideas);
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/search failed", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
