import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { audit } from "@/lib/audit";
import { saveGithubConnection } from "@/lib/github/connection";
import { GITHUB_STATE_COOKIE, githubRedirectUri, safeNextPath } from "@/lib/github/oauth";

function sameState(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Finishes the GitHub OAuth flow: checks state, swaps the code for a token, stores it encrypted for this user. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  let saved: { state?: string; next?: string } = {};
  try {
    saved = JSON.parse(request.cookies.get(GITHUB_STATE_COOKIE)?.value ?? "{}");
  } catch {
    // Treated as a missing state below.
  }
  const next = safeNextPath(saved.next);

  function finish(result: string) {
    const url = new URL(next, request.nextUrl.origin);
    url.searchParams.set("github", result);
    const response = NextResponse.redirect(url);
    response.cookies.delete(GITHUB_STATE_COOKIE);
    return response;
  }

  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  if (params.get("error")) return finish("denied");
  if (!code || !state || !saved.state || !sameState(state, saved.state)) return finish("error");

  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: githubRedirectUri(request.nextUrl.origin),
      }),
    });
    const tokenBody = (await tokenRes.json()) as { access_token?: string; scope?: string };
    if (!tokenBody.access_token) return finish("error");

    const userRes = await fetch("https://api.github.com/user", {
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${tokenBody.access_token}` },
    });
    if (!userRes.ok) return finish("error");
    const profile = (await userRes.json()) as { login?: string };
    if (!profile.login) return finish("error");

    await saveGithubConnection(user.id, tokenBody.access_token, profile.login, tokenBody.scope ?? "");
    await audit({ action: "github.connected", actorId: user.id, entityType: "user", entityId: user.id, meta: { login: profile.login }, request });
    return finish("connected");
  } catch (error) {
    console.error("GET /api/github/callback failed", error);
    return finish("error");
  }
}
