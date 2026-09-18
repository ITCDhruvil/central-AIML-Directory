export interface ParsedGitHubUrl {
  owner: string;
  repo: string;
}

const SEGMENT_PATTERN = /^[A-Za-z0-9_.-]+$/;

/**
 * Parses a GitHub repository URL (e.g. https://github.com/owner/repo or
 * https://github.com/owner/repo/) into owner/repo. Rejects anything that
 * isn't exactly a two-segment repository path — org/user profile URLs,
 * search URLs, issue/PR URLs, etc.
 */
export function parseGitHubRepoUrl(input: string): ParsedGitHubUrl | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }

  if (url.hostname !== "github.com" && url.hostname !== "www.github.com") {
    return null;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length !== 2) {
    return null;
  }

  const [owner, repoRaw] = segments;
  const repo = repoRaw.replace(/\.git$/, "");

  if (!SEGMENT_PATTERN.test(owner) || !SEGMENT_PATTERN.test(repo)) {
    return null;
  }

  return { owner, repo };
}
