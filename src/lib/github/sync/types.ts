import type { GitHubDocument } from "@/types/github";
import type { DocumentCategory } from "@/types/documentation";
import type { Technology } from "@/types/technology";
import type { SetupGuideData } from "@/lib/github/setup/types";

export interface StoredDocumentSummary {
  documentId: string;
  title: string;
  filePath: string;
  category: DocumentCategory;
}

export interface SyncRepositoryDiff {
  changed: boolean;
  current: { githubOwner: string | null; githubRepo: string | null; defaultBranch: string | null };
  incoming: { githubOwner: string; githubRepo: string; defaultBranch: string };
}

export interface SyncReadmeDiff {
  changed: boolean;
  documentId: string | null;
  current: string | null;
  incoming: string | null;
}

export interface SyncDocumentsDiff {
  added: GitHubDocument[];
  modified: (GitHubDocument & { documentId: string })[];
  removed: StoredDocumentSummary[];
  unchanged: StoredDocumentSummary[];
}

export interface SyncTechnologiesDiff {
  added: Technology[];
  removed: Technology[];
  changed: { name: string; from: Technology; to: Technology }[];
  unchanged: Technology[];
  manual: Technology[];
  /** The raw freshly-detected list, for reference. */
  detected: Technology[];
}

export interface SyncSetupGuideDiff {
  /** Whether a generated guide currently exists in the project at all. */
  exists: boolean;
  documentId: string | null;
  /** True if regenerating would produce different content than what's stored. */
  changed: boolean;
  /** True if the stored content no longer matches its generation-time hash — i.e. the user edited it. */
  userModified: boolean;
  incoming: SetupGuideData;
}

export interface SyncPreview {
  projectId: string;
  /** The project's updatedAt at preview time — must be echoed back to /apply unchanged. */
  projectUpdatedAt: string;
  repository: SyncRepositoryDiff;
  readme: SyncReadmeDiff;
  documents: SyncDocumentsDiff;
  technologies: SyncTechnologiesDiff;
  setupGuide: SyncSetupGuideDiff;
  warnings: string[];
}

export interface ApplySyncRequest {
  projectUpdatedAt: string;
  applyRepositoryMetadata: boolean;
  applyReadme: boolean;
  documents: {
    add: string[];
    update: string[];
    remove: string[];
  };
  technologies: {
    applyDetectedChanges: boolean;
  };
  setupGuide: {
    applyGeneratedUpdate: boolean;
  };
}
