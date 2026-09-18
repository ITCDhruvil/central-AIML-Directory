import "server-only";
import type { GitHubDocument, GitHubImportResult, GitHubReadme, GitHubRepository, GitHubSkippedDocument } from "@/types/github";
import { classifyDocument, generateTitle, isDocCandidate, MAX_DOC_FILE_BYTES } from "@/lib/github/documents";
import { detectTechnologies, isTechDetectionCandidate } from "@/lib/github/technology/detector";
import { buildSetupGuide } from "@/lib/github/setup/builder";
import { isSetupEvidenceCandidate } from "@/lib/github/setup/evidence";

const GITHUB_API_BASE = "https://api.github.com";

export type GitHubErrorCode = "not_found" | "unauthorized" | "rate_limited" | "network" | "unknown";

export class GitHubApiError extends Error {
  constructor(
    public readonly code: GitHubErrorCode,
    message: string,
  ) {
    super(message);
  }
}

function authHeaders(): HeadersInit {
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function githubFetch(path: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${GITHUB_API_BASE}${path}`, { headers: authHeaders() });
  } catch {
    throw new GitHubApiError("network", "Could not reach GitHub. Please try again.");
  }

  if (res.status === 404) {
    throw new GitHubApiError("not_found", "Repository not found or you do not have access to it.");
  }
  if (res.status === 401) {
    throw new GitHubApiError(
      "unauthorized",
      "GitHub authentication failed. Check the configured GITHUB_TOKEN.",
    );
  }
  if (res.status === 403) {
    const remaining = res.headers.get("x-ratelimit-remaining");
    if (remaining === "0") {
      throw new GitHubApiError("rate_limited", "GitHub API rate limit exceeded. Please try again later.");
    }
    throw new GitHubApiError(
      "unauthorized",
      "GitHub denied access to this repository. A GitHub token with access may be required.",
    );
  }
  if (!res.ok) {
    throw new GitHubApiError("unknown", "GitHub API request failed.");
  }

  return res;
}

interface RawGitHubRepository {
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  default_branch: string;
  owner: { login: string };
}

async function fetchGitHubRepository(owner: string, repo: string): Promise<GitHubRepository> {
  const res = await githubFetch(`/repos/${owner}/${repo}`);
  const data = (await res.json()) as RawGitHubRepository;

  return {
    name: data.name,
    fullName: data.full_name,
    description: data.description,
    htmlUrl: data.html_url,
    defaultBranch: data.default_branch,
    owner: data.owner.login,
  };
}

interface RawGitHubReadme {
  content: string;
  encoding: string;
}

async function fetchGitHubReadme(owner: string, repo: string): Promise<GitHubReadme> {
  let res: Response;
  try {
    res = await githubFetch(`/repos/${owner}/${repo}/readme`);
  } catch (error) {
    if (error instanceof GitHubApiError && error.code === "not_found") {
      return { exists: false, content: "" };
    }
    throw error;
  }

  const data = (await res.json()) as RawGitHubReadme;
  const content =
    data.encoding === "base64" ? Buffer.from(data.content, "base64").toString("utf-8") : data.content;

  return { exists: true, content };
}

/** Lightweight README fetch for autofill when the client has no imported README in memory. */
export async function fetchRepositoryReadme(owner: string, repo: string): Promise<GitHubReadme> {
  return fetchGitHubReadme(owner, repo);
}

interface RawGitTreeEntry {
  path: string;
  type: string;
  size?: number;
}

interface RawGitTreeResponse {
  tree: RawGitTreeEntry[];
}

async function fetchRepositoryTree(owner: string, repo: string, branch: string): Promise<RawGitTreeEntry[]> {
  const res = await githubFetch(`/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
  const data = (await res.json()) as RawGitTreeResponse;
  return data.tree.filter((entry) => entry.type === "blob");
}

interface RawGitHubContentFile {
  content: string;
  encoding: string;
}

async function fetchFileContent(owner: string, repo: string, path: string, ref: string): Promise<string> {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const res = await githubFetch(`/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`);
  const data = (await res.json()) as RawGitHubContentFile;
  return data.encoding === "base64" ? Buffer.from(data.content, "base64").toString("utf-8") : data.content;
}

const MAX_EVIDENCE_FILES = 30;

/**
 * Fetches the files needed for both technology detection and setup-guide
 * evidence in one pass, so the two features never issue duplicate requests
 * for the same file.
 */
async function fetchEvidenceFiles(
  owner: string,
  repo: string,
  treeEntries: RawGitTreeEntry[],
  ref: string,
): Promise<Record<string, string>> {
  const candidates = treeEntries
    .filter((entry) => isTechDetectionCandidate(entry.path) || isSetupEvidenceCandidate(entry.path))
    .slice(0, MAX_EVIDENCE_FILES);
  const files: Record<string, string> = {};

  for (const entry of candidates) {
    try {
      files[entry.path] = await fetchFileContent(owner, repo, entry.path, ref);
    } catch (error) {
      if (error instanceof GitHubApiError && error.code === "rate_limited") {
        throw error;
      }
      // Unreadable candidate file — not fatal to detection, just skip it.
    }
  }

  return files;
}

/**
 * Fetches repository metadata, README, discovered documentation, and detected
 * technologies for the import preview. Server-side only. Does not save
 * anything to the database.
 */
export async function importGitHubRepository(owner: string, repo: string): Promise<GitHubImportResult> {
  const repository = await fetchGitHubRepository(owner, repo);
  const readme = await fetchGitHubReadme(owner, repo);
  const treeEntries = await fetchRepositoryTree(owner, repo, repository.defaultBranch);

  const documents: GitHubDocument[] = [];
  const skipped: GitHubSkippedDocument[] = [];

  if (readme.exists) {
    documents.push({ title: "README", category: "README", filePath: "README.md", content: readme.content });
  }

  const docCandidates = treeEntries.filter((entry) => isDocCandidate(entry.path));

  for (const entry of docCandidates) {
    if (typeof entry.size === "number" && entry.size > MAX_DOC_FILE_BYTES) {
      skipped.push({ filePath: entry.path, reason: "File exceeds the 1 MB documentation size limit" });
      continue;
    }

    try {
      const content = await fetchFileContent(owner, repo, entry.path, repository.defaultBranch);
      documents.push({
        title: generateTitle(entry.path),
        category: classifyDocument(entry.path),
        filePath: entry.path,
        content,
      });
    } catch (error) {
      if (error instanceof GitHubApiError && error.code === "rate_limited") {
        throw error;
      }
      skipped.push({ filePath: entry.path, reason: "Could not read this file" });
    }
  }

  const evidenceFiles = await fetchEvidenceFiles(owner, repo, treeEntries, repository.defaultBranch);
  const readmeContent = readme.exists ? readme.content : "";
  const technologies = detectTechnologies({ files: evidenceFiles, readmeContent });

  const nativeSetupDoc = documents.find((d) => d.category === "SETUP");
  const setupGuide = buildSetupGuide({
    repository,
    technologies,
    files: evidenceFiles,
    readmeContent,
    supplementaryDocText: nativeSetupDoc?.content,
  });

  return { repository, readme, documents, technologies, setupGuide, skipped };
}
