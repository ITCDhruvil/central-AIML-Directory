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
