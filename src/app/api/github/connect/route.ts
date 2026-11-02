import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { isGithubOAuthConfigured } from "@/lib/github/connection";
import { GITHUB_STATE_COOKIE, githubRedirectUri, safeNextPath } from "@/lib/github/oauth";

/** Starts the GitHub OAuth flow: remembers a one-time state and where to return to, then sends the user to GitHub. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  if (!isGithubOAuthConfigured()) {
    const back = new URL(next, request.nextUrl.origin);
    back.searchParams.set("github", "not_configured");
    return NextResponse.redirect(back);
  }

  const state = randomBytes(24).toString("base64url");
  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", process.env.GITHUB_CLIENT_ID as string);
  authorize.searchParams.set("redirect_uri", githubRedirectUri(request.nextUrl.origin));
  // "repo" is the narrowest classic OAuth scope that can read private repositories.
  authorize.searchParams.set("scope", "repo");
  authorize.searchParams.set("state", state);

  const response = NextResponse.redirect(authorize);
  response.cookies.set(GITHUB_STATE_COOKIE, JSON.stringify({ state, next }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}
