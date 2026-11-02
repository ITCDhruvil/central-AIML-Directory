export const GITHUB_STATE_COOKIE = "gh_oauth_state";

/** Only same-site relative paths may be returned to, so the flow cannot be turned into an open redirect. */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/projects/new";
  return value;
}

export function githubRedirectUri(origin: string): string {
  return process.env.GITHUB_OAUTH_REDIRECT_URI || `${origin}/api/github/callback`;
}
