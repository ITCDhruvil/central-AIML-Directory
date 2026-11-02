import "server-only";
import { getAuthSecret } from "@/lib/auth/config";
import { prisma } from "@/lib/prisma";
import { decryptToken, encryptToken } from "@/lib/github/tokenCrypto";
import type { GithubConnectionDetails, GithubRepoRow } from "@/types/github";

/** The user's own GitHub access token, or null when they have not connected (or it can no longer be decrypted). */
export async function getUserGithubToken(userId: string): Promise<string | null> {
  const row = await prisma.githubConnection.findUnique({ where: { userId }, select: { accessToken: true } });
  return row ? decryptToken(row.accessToken, getAuthSecret()) : null;
}

interface RawGithubUser {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  public_repos: number;
  total_private_repos?: number;
}

/**
 * Everything the Settings card shows. Asks GitHub who the stored token belongs to, so the card also notices a token
 * that was revoked on GitHub's side rather than claiming "connected" forever.
 */
export async function getGithubConnectionDetails(userId: string): Promise<GithubConnectionDetails> {
  const configured = isGithubOAuthConfigured();
  const row = await prisma.githubConnection.findUnique({ where: { userId } });
  if (!row) return { connected: false, configured };

  const base = {
    connected: true,
    configured,
    login: row.login,
    connectedAt: row.createdAt.toISOString(),
    scopes: row.scope.split(/[,\s]+/).filter(Boolean),
  };

  const token = decryptToken(row.accessToken, getAuthSecret());
  if (!token) return { ...base, state: "expired" };

  try {
    const res = await fetch("https://api.github.com/user", {
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 401) return { ...base, state: "expired" };
    if (!res.ok) return { ...base, state: "unavailable" };

    const user = (await res.json()) as RawGithubUser;
    return {
      ...base,
      state: "ok",
      login: user.login,
      profile: {
        name: user.name,
        avatarUrl: user.avatar_url,
        profileUrl: user.html_url,
        publicRepos: user.public_repos,
        privateRepos: typeof user.total_private_repos === "number" ? user.total_private_repos : null,
      },
    };
  } catch {
    return { ...base, state: "unavailable" };
  }
}

interface RawGithubRepo {
  name: string;
  full_name: string;
  owner: { login: string };
  description: string | null;
  html_url: string;
  private: boolean;
  fork: boolean;
  archived: boolean;
  language: string | null;
  stargazers_count: number;
  pushed_at: string | null;
}

const REPOS_PER_PAGE = 100;

/** The repositories the person's own GitHub account can open, most recently pushed first (one page of 100). */
export async function listUserRepositories(
  token: string,
): Promise<{ state: "ok" | "expired" | "unavailable"; repos: Omit<GithubRepoRow, "project">[]; truncated: boolean }> {
  try {
    const res = await fetch(
      `https://api.github.com/user/repos?per_page=${REPOS_PER_PAGE}&sort=pushed&affiliation=owner,collaborator,organization_member`,
      {
        headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (res.status === 401) return { state: "expired", repos: [], truncated: false };
    if (!res.ok) return { state: "unavailable", repos: [], truncated: false };

    const raw = (await res.json()) as RawGithubRepo[];
    return {
      state: "ok",
      // GitHub signals another page with a rel="next" Link header.
      truncated: /rel="next"/.test(res.headers.get("link") ?? ""),
      repos: raw.map((r) => ({
        fullName: r.full_name,
        name: r.name,
        owner: r.owner.login,
        description: r.description,
        htmlUrl: r.html_url,
        isPrivate: r.private,
        isFork: r.fork,
        isArchived: r.archived,
        language: r.language,
        stars: r.stargazers_count,
        pushedAt: r.pushed_at,
      })),
    };
  } catch {
    return { state: "unavailable", repos: [], truncated: false };
  }
}

export async function saveGithubConnection(userId: string, token: string, login: string, scope: string): Promise<void> {
  const accessToken = encryptToken(token, getAuthSecret());
  await prisma.githubConnection.upsert({
    where: { userId },
    create: { userId, accessToken, login, scope },
    update: { accessToken, login, scope },
  });
}

export async function deleteGithubConnection(userId: string): Promise<void> {
  await prisma.githubConnection.deleteMany({ where: { userId } });
}

/** True when the server has a GitHub OAuth app configured. */
export function isGithubOAuthConfigured(): boolean {
  return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
}
