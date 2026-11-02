import "server-only";
import { getAuthSecret } from "@/lib/auth/config";
import { prisma } from "@/lib/prisma";
import { decryptToken, encryptToken } from "@/lib/github/tokenCrypto";

/** The user's own GitHub access token, or null when they have not connected (or it can no longer be decrypted). */
export async function getUserGithubToken(userId: string): Promise<string | null> {
  const row = await prisma.githubConnection.findUnique({ where: { userId }, select: { accessToken: true } });
  return row ? decryptToken(row.accessToken, getAuthSecret()) : null;
}

export async function getGithubConnectionStatus(userId: string): Promise<{ connected: boolean; login: string | null }> {
  const row = await prisma.githubConnection.findUnique({ where: { userId }, select: { login: true } });
  return { connected: Boolean(row), login: row?.login ?? null };
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
