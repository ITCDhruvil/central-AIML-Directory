/**
 * Fixed locale ("en-US") deliberately — using the browser's default locale
 * here would render differently on the server vs. the client and cause a
 * hydration mismatch (see SyncGitHubPanel.tsx for the original report).
 */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
