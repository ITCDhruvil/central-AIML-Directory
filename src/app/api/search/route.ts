import { apiAuthorize, loadViewAccess } from "@/lib/auth/dal";
import { NextRequest, NextResponse } from "next/server";
import { ideaScopeWhere, projectScopeWhere } from "@/lib/auth/scope";
import { prisma } from "@/lib/prisma";
import { toIdea } from "@/lib/ideaMapper";
import { toProject } from "@/lib/projectMapper";
import { searchPortfolio } from "@/lib/search/search";
import type { SearchableDocument } from "@/lib/search/types";
import type { Idea } from "@/types/idea";
import type { Project } from "@/types/project";
import type { DocumentCategory } from "@/types/documentation";

const CACHE_MS = 15_000;
type SearchData = { expires: number; projects: Project[]; ideas: Idea[]; documents: SearchableDocument[] };
const dataCache = new Map<string, SearchData>();

/**
 * Global search across project metadata, ideas, and documentation content.
 * Deterministic, server-side, no external services. Fetches minimal columns
 * only — full document content never reaches the browser, only computed
 * snippets do.
 */
export async function GET(request: NextRequest) {
  const auth = await apiAuthorize("search", "view");
  if (!auth.ok) return auth.response;

  const query = request.nextUrl.searchParams.get("q") ?? "";

  if (!query.trim()) {
    return NextResponse.json({ query: "", projects: [], ideas: [], documentation: [] });
  }

  try {
    // Results mix three entity kinds; each follows its own view permission (documents via their project). The searchable
    // data is kept per person for a few seconds, so typing a query letter by letter reads the database once, not per key.
    const cached = dataCache.get(auth.user.id);
    let data = cached && cached.expires > Date.now() ? cached : null;
    if (!data) {
      const view = await loadViewAccess(auth.user);
      const [projectRows, ideaRows, documentRows] = await Promise.all([
        prisma.project.findMany({ where: projectScopeWhere(view.projects) }),
        prisma.idea.findMany({ where: ideaScopeWhere(view.ideas) }),
        prisma.documentation.findMany({
          where: view.documents.all ? {} : { project: projectScopeWhere(view.documents) },
          select: { id: true, projectId: true, title: true, category: true, content: true },
        }),
      ]);
      data = {
        expires: Date.now() + CACHE_MS,
        projects: projectRows.map(toProject),
        ideas: ideaRows.map(toIdea),
        documents: documentRows.map((row) => ({
          id: row.id,
          projectId: row.projectId,
          title: row.title,
          category: row.category as DocumentCategory,
          content: row.content,
        })),
      };
      dataCache.set(auth.user.id, data);
      if (dataCache.size > 200) dataCache.delete(dataCache.keys().next().value as string);
    }
    const { projects, ideas, documents } = data;

    const result = searchPortfolio(query, projects, documents, ideas);
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/search failed", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
