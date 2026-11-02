import { NextResponse } from "next/server";
import { apiAuthorize } from "@/lib/auth/dal";
import { andWhere, projectScopeWhere } from "@/lib/auth/scope";
import { getUserGithubToken, listUserRepositories } from "@/lib/github/connection";
import { prisma } from "@/lib/prisma";
import type { GithubReposResponse } from "@/types/github";

/** The signed-in person's GitHub repositories, marked with any project here that already points at one. */
export async function GET() {
  const auth = await apiAuthorize("projects", "view");
  if (!auth.ok) return auth.response;

  const token = await getUserGithubToken(auth.user.id);
  if (!token) {
    return NextResponse.json({ error: "Connect your GitHub account first." }, { status: 403 });
  }

  const { state, repos, truncated } = await listUserRepositories(token);

  // Only projects this person may see, so a repository name can never reveal a project they have no access to.
  const projects = repos.length
    ? await prisma.project.findMany({
        where: andWhere({ githubRepo: { not: null } }, projectScopeWhere(auth.access)),
        select: { id: true, name: true, githubOwner: true, githubRepo: true },
      })
    : [];
  const byRepo = new Map(
    projects.map((p) => [`${p.githubOwner ?? ""}/${p.githubRepo ?? ""}`.toLowerCase(), { id: p.id, name: p.name }]),
  );

  const body: GithubReposResponse = {
    state,
    truncated,
    repos: repos.map((r) => ({ ...r, project: byRepo.get(r.fullName.toLowerCase()) ?? null })),
  };
  return NextResponse.json(body);
}
