import "server-only";
import { NextResponse } from "next/server";
import { getUserGithubToken } from "@/lib/github/connection";

export const GITHUB_NOT_CONNECTED = "github_not_connected";

/**
 * For routes that read repositories on the user's behalf: returns their GitHub token, or a 403 response with a
 * `code` the UI turns into a "Connect GitHub" prompt.
 */
export async function requireGithubToken(userId: string): Promise<{ token: string } | { response: NextResponse }> {
  const token = await getUserGithubToken(userId);
  if (token) return { token };
  return {
    response: NextResponse.json(
      { error: "Connect your GitHub account first to import repositories.", code: GITHUB_NOT_CONNECTED },
      { status: 403 },
    ),
  };
}
