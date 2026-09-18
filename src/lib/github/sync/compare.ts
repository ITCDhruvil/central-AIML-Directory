import type { Documentation, DocumentCategory } from "@/types/documentation";
import type { Project } from "@/types/project";
import type { GitHubDocument, GitHubRepository, GitHubReadme } from "@/types/github";
import type { Technology } from "@/types/technology";
import type { SetupGuideData } from "@/lib/github/setup/types";
import { sha256 } from "@/lib/hash";
import type {
  StoredDocumentSummary,
  SyncDocumentsDiff,
  SyncReadmeDiff,
  SyncRepositoryDiff,
  SyncSetupGuideDiff,
  SyncTechnologiesDiff,
} from "@/lib/github/sync/types";

export function compareRepository(project: Project, incoming: GitHubRepository): SyncRepositoryDiff {
  const current = {
    githubOwner: project.githubOwner,
    githubRepo: project.githubRepo,
    defaultBranch: project.defaultBranch,
  };
  const inc = { githubOwner: incoming.owner, githubRepo: incoming.name, defaultBranch: incoming.defaultBranch };
  const changed =
    current.githubOwner !== inc.githubOwner ||
    current.githubRepo !== inc.githubRepo ||
    current.defaultBranch !== inc.defaultBranch;
  return { changed, current, incoming: inc };
}

function isStoredReadme(doc: Documentation): boolean {
  return doc.source === "github" && doc.category === "README" && doc.filePath === "README.md";
}

export function compareReadme(stored: Documentation[], incoming: GitHubReadme): SyncReadmeDiff {
  const storedReadme = stored.find(isStoredReadme) ?? null;
  const current = storedReadme?.content ?? null;
  const incomingContent = incoming.exists ? incoming.content : null;
  return {
    changed: current !== incomingContent,
    documentId: storedReadme?.id ?? null,
    current,
    incoming: incomingContent,
  };
}

/** Excludes README — that's compared separately via compareReadme. */
export function compareDocuments(stored: Documentation[], incoming: GitHubDocument[]): SyncDocumentsDiff {
  const storedGithubDocs = stored.filter((d) => d.source === "github" && !isStoredReadme(d));
  const incomingDocs = incoming.filter((d) => !(d.category === "README" && d.filePath === "README.md"));

  const storedByPath = new Map(storedGithubDocs.map((d) => [d.filePath, d]));
  const incomingByPath = new Map(incomingDocs.map((d) => [d.filePath, d]));

  const added: GitHubDocument[] = [];
  const modified: (GitHubDocument & { documentId: string })[] = [];
  const unchanged: StoredDocumentSummary[] = [];

  for (const [path, doc] of incomingByPath) {
    const existing = storedByPath.get(path);
    if (!existing) {
      added.push(doc);
    } else if (existing.content !== doc.content || existing.category !== doc.category) {
      modified.push({ ...doc, documentId: existing.id });
    } else {
      unchanged.push(summarize(existing));
    }
  }

  const removed: StoredDocumentSummary[] = [];
  for (const [path, doc] of storedByPath) {
    if (!incomingByPath.has(path)) {
      removed.push(summarize(doc));
    }
  }

  return { added, modified, removed, unchanged };
}

function summarize(doc: Documentation): StoredDocumentSummary {
  return { documentId: doc.id, title: doc.title, filePath: doc.filePath, category: doc.category as DocumentCategory };
}

const MANUAL_EVIDENCE = "manual";

function isManualTechnology(t: Technology): boolean {
  return t.evidence.length === 1 && t.evidence[0] === MANUAL_EVIDENCE;
}

function evidenceSetEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  return b.every((item) => setA.has(item));
}

export function compareTechnologies(stored: Technology[], incomingDetected: Technology[]): SyncTechnologiesDiff {
  const manual = stored.filter(isManualTechnology);
  const storedDetected = stored.filter((t) => !isManualTechnology(t));

  const storedByName = new Map(storedDetected.map((t) => [t.name.toLowerCase(), t]));
  const incomingByName = new Map(incomingDetected.map((t) => [t.name.toLowerCase(), t]));

  const added: Technology[] = [];
  const changed: { name: string; from: Technology; to: Technology }[] = [];
  const unchanged: Technology[] = [];

  for (const [key, incoming] of incomingByName) {
    const previous = storedByName.get(key);
    if (!previous) {
      added.push(incoming);
    } else if (
      previous.category !== incoming.category ||
      previous.confidence !== incoming.confidence ||
      !evidenceSetEqual(previous.evidence, incoming.evidence)
    ) {
      changed.push({ name: incoming.name, from: previous, to: incoming });
    } else {
      unchanged.push(incoming);
    }
  }

  const removed: Technology[] = [];
  for (const [key, previous] of storedByName) {
    if (!incomingByName.has(key)) removed.push(previous);
  }

  return { added, removed, changed, unchanged, manual, detected: incomingDetected };
}

/** GitHub-detected technologies plus preserved manual ones, deduped by name (manual wins on collision). */
export function mergeTechnologies(incomingDetected: Technology[], manual: Technology[]): Technology[] {
  const merged = new Map<string, Technology>();
  for (const t of incomingDetected) merged.set(t.name.toLowerCase(), t);
  for (const t of manual) merged.set(t.name.toLowerCase(), t);
  return [...merged.values()];
}

export function compareSetupGuide(stored: Documentation | null, incoming: SetupGuideData): SyncSetupGuideDiff {
  if (!stored) {
    return { exists: false, documentId: null, changed: true, userModified: false, incoming };
  }
  const currentHash = sha256(stored.content);
  const userModified = stored.generatedFromContentHash !== null && stored.generatedFromContentHash !== currentHash;
  const changed = stored.content !== incoming.content;
  return { exists: true, documentId: stored.id, changed, userModified, incoming };
}
