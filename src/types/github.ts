import type { DocumentCategory } from "@/types/documentation";
import type { Technology } from "@/types/technology";
import type { SetupGuideData } from "@/lib/github/setup/types";

export interface GitHubRepository {
  name: string;
  fullName: string;
  description: string | null;
  htmlUrl: string;
  defaultBranch: string;
  owner: string;
}

export interface GitHubReadme {
  exists: boolean;
  content: string;
}

export interface GitHubDocument {
  title: string;
  category: DocumentCategory;
  filePath: string;
  content: string;
}

export interface GitHubSkippedDocument {
  filePath: string;
  reason: string;
}

export interface GitHubImportResult {
  repository: GitHubRepository;
  readme: GitHubReadme;
  documents: GitHubDocument[];
  technologies: Technology[];
  setupGuide: SetupGuideData;
  skipped: GitHubSkippedDocument[];
}

/** What the Settings card shows about a person's GitHub connection. Never includes the token. */
export interface GithubConnectionDetails {
  connected: boolean;
  /** False when the server has no GitHub OAuth App configured. */
  configured: boolean;
  /**
   * ok: GitHub accepted the token just now. expired: GitHub rejected it (or it can no longer be read), so the person
   * must reconnect. unavailable: GitHub could not be reached, so only the stored facts below are shown.
   */
  state?: "ok" | "expired" | "unavailable";
  login?: string;
  connectedAt?: string;
  scopes?: string[];
  profile?: {
    name: string | null;
    avatarUrl: string;
    profileUrl: string;
    publicRepos: number;
    /** Only GitHub reports this for the signed-in owner; null when it does not. */
    privateRepos: number | null;
  };
}

/** One row of the repositories table on the GitHub settings card. */
export interface GithubRepoRow {
  fullName: string;
  name: string;
  owner: string;
  description: string | null;
  htmlUrl: string;
  isPrivate: boolean;
  isFork: boolean;
  isArchived: boolean;
  language: string | null;
  stars: number;
  pushedAt: string | null;
  /** Set when a project in this app already points at the repository (and the viewer may see it). */
  project: { id: string; name: string } | null;
}

export interface GithubReposResponse {
  state: "ok" | "expired" | "unavailable";
  repos: GithubRepoRow[];
  /** True when the person has more repositories than were fetched. */
  truncated: boolean;
}
