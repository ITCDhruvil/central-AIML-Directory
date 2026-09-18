import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compareDocuments,
  compareReadme,
  compareRepository,
  compareSetupGuide,
  compareTechnologies,
  mergeTechnologies,
} from "@/lib/github/sync/compare";
import { sha256 } from "@/lib/hash";
import type { Documentation } from "@/types/documentation";
import type { GitHubDocument, GitHubRepository } from "@/types/github";
import type { Project } from "@/types/project";
import type { Technology } from "@/types/technology";
import type { SetupGuideData } from "@/lib/github/setup/types";

function doc(overrides: Partial<Documentation> = {}): Documentation {
  return {
    id: "doc_1",
    projectId: "proj_1",
    title: "Doc",
    category: "OTHER",
    filePath: "docs/DOC.md",
    content: "content",
    source: "github",
    generatedFromContentHash: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function githubDoc(overrides: Partial<GitHubDocument> = {}): GitHubDocument {
  return { title: "Doc", category: "OTHER", filePath: "docs/DOC.md", content: "content", ...overrides };
}

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: "proj_1",
    name: "widgets",
    slug: "widgets",
    description: null,
    type: "PROJECT",
    status: "ACTIVE",
    stage: null,
    owner: null,
    githubUrl: "https://github.com/acme/widgets",
    githubOwner: "acme",
    githubRepo: "widgets",
    defaultBranch: "main",
    technologies: [],
    tags: [],
    deploymentUrls: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    lastSyncedAt: null,
    ...overrides,
  };
}

function repo(overrides: Partial<GitHubRepository> = {}): GitHubRepository {
  return {
    name: "widgets",
    fullName: "acme/widgets",
    description: null,
    htmlUrl: "https://github.com/acme/widgets",
    defaultBranch: "main",
    owner: "acme",
    ...overrides,
  };
}

function tech(overrides: Partial<Technology> = {}): Technology {
  return { name: "React", category: "FRAMEWORK", evidence: ["package.json"], confidence: "HIGH", ...overrides };
}

// --- Documentation ---------------------------------------------------------

test("1. New GitHub document appears as added", () => {
  const diff = compareDocuments([], [githubDoc({ filePath: "docs/API.md" })]);
  assert.equal(diff.added.length, 1);
  assert.equal(diff.added[0].filePath, "docs/API.md");
});

test("2. Existing unchanged document appears as unchanged", () => {
  const stored = [doc({ filePath: "docs/ARCH.md", content: "same", category: "ARCHITECTURE" })];
  const diff = compareDocuments(stored, [githubDoc({ filePath: "docs/ARCH.md", content: "same", category: "ARCHITECTURE" })]);
  assert.equal(diff.unchanged.length, 1);
  assert.equal(diff.modified.length, 0);
});

test("3. Modified document (content changed) appears as modified with documentId", () => {
  const stored = [doc({ id: "doc_arch", filePath: "docs/ARCH.md", content: "old", category: "ARCHITECTURE" })];
  const diff = compareDocuments(stored, [githubDoc({ filePath: "docs/ARCH.md", content: "new", category: "ARCHITECTURE" })]);
  assert.equal(diff.modified.length, 1);
  assert.equal(diff.modified[0].documentId, "doc_arch");
  assert.equal(diff.modified[0].content, "new");
});

test("3b. Modified document (category changed only) also appears as modified", () => {
  const stored = [doc({ filePath: "docs/X.md", content: "same", category: "OTHER" })];
  const diff = compareDocuments(stored, [githubDoc({ filePath: "docs/X.md", content: "same", category: "DESIGN" })]);
  assert.equal(diff.modified.length, 1);
});

test("4. Document removed from GitHub appears as removed, not deleted", () => {
  const stored = [doc({ id: "doc_old", filePath: "OLD_SETUP.md" })];
  const diff = compareDocuments(stored, []);
  assert.equal(diff.removed.length, 1);
  assert.equal(diff.removed[0].documentId, "doc_old");
  assert.equal(diff.removed[0].filePath, "OLD_SETUP.md");
});

test("5. File path identity is case-sensitive", () => {
  const stored = [doc({ filePath: "docs/API.md", content: "same" })];
  const diff = compareDocuments(stored, [githubDoc({ filePath: "docs/api.md", content: "same" })]);
  // Different case -> different identity -> treated as both an add and a removal, not "unchanged".
  assert.equal(diff.unchanged.length, 0);
  assert.equal(diff.added.length, 1);
  assert.equal(diff.removed.length, 1);
});

test("README is excluded from the documents diff entirely (handled separately)", () => {
  const stored = [doc({ filePath: "README.md", category: "README" })];
  const diff = compareDocuments(stored, [githubDoc({ filePath: "README.md", category: "README", content: "new readme" })]);
  assert.equal(diff.added.length, 0);
  assert.equal(diff.modified.length, 0);
  assert.equal(diff.unchanged.length, 0);
  assert.equal(diff.removed.length, 0);
});

test("generated documents are never included in the GitHub documents diff", () => {
  const stored = [doc({ source: "generated", filePath: "[generated]/SETUP_GUIDE.md" })];
  const diff = compareDocuments(stored, []);
  assert.equal(diff.removed.length, 0, "generated docs must not be reported as removed-from-GitHub");
});

// --- README ------------------------------------------------------------------

test("README changed is detected", () => {
  const stored = [doc({ filePath: "README.md", category: "README", content: "old readme" })];
  const diff = compareReadme(stored, { exists: true, content: "new readme" });
  assert.equal(diff.changed, true);
  assert.equal(diff.current, "old readme");
  assert.equal(diff.incoming, "new readme");
});

test("README unchanged", () => {
  const stored = [doc({ filePath: "README.md", category: "README", content: "same" })];
  const diff = compareReadme(stored, { exists: true, content: "same" });
  assert.equal(diff.changed, false);
});

// --- Technologies ---------------------------------------------------------

test("6. New detected technology appears as added", () => {
  const diff = compareTechnologies([], [tech({ name: "FastAPI" })]);
  assert.equal(diff.added.length, 1);
  assert.equal(diff.added[0].name, "FastAPI");
});

test("7. Removed detected technology appears as removed", () => {
  const stored = [tech({ name: "Flask" })];
  const diff = compareTechnologies(stored, []);
  assert.equal(diff.removed.length, 1);
  assert.equal(diff.removed[0].name, "Flask");
});

test("8. Same technology (identical evidence/category/confidence) is unchanged", () => {
  const stored = [tech({ name: "React", evidence: ["package.json"] })];
  const incoming = [tech({ name: "React", evidence: ["package.json"] })];
  const diff = compareTechnologies(stored, incoming);
  assert.equal(diff.unchanged.length, 1);
  assert.equal(diff.changed.length, 0);
});

test("9. Evidence change classifies technology as changed", () => {
  const stored = [tech({ name: "React", evidence: ["package.json"] })];
  const incoming = [tech({ name: "React", evidence: ["package.json", "README.md"] })];
  const diff = compareTechnologies(stored, incoming);
  assert.equal(diff.changed.length, 1);
  assert.equal(diff.changed[0].name, "React");
});

test("Harmless evidence reordering is NOT treated as a change", () => {
  const stored = [tech({ name: "React", evidence: ["package.json", "README.md"] })];
  const incoming = [tech({ name: "React", evidence: ["README.md", "package.json"] })];
  const diff = compareTechnologies(stored, incoming);
  assert.equal(diff.unchanged.length, 1);
  assert.equal(diff.changed.length, 0);
});

test("10. Manual technology survives sync even if not re-detected", () => {
  const stored = [tech({ name: "Docker", evidence: ["manual"] })];
  const diff = compareTechnologies(stored, []); // Docker not detected from GitHub at all
  assert.equal(diff.manual.length, 1);
  assert.equal(diff.manual[0].name, "Docker");
  assert.equal(diff.removed.length, 0, "manual technologies must never be reported as removed");

  const merged = mergeTechnologies(diff.detected, diff.manual);
  assert.ok(merged.some((t) => t.name === "Docker"), "Docker must survive into the merged set");
});

test("11. Duplicate manual/detected technology merges correctly (detected + manual, no duplicate)", () => {
  // User manually added "React" (maybe before GitHub detection caught it); GitHub now also detects it.
  const manual = [tech({ name: "React", evidence: ["manual"], confidence: "HIGH" })];
  const detected = [tech({ name: "React", evidence: ["package.json"], confidence: "HIGH" })];
  const merged = mergeTechnologies(detected, manual);
  const reactEntries = merged.filter((t) => t.name === "React");
  assert.equal(reactEntries.length, 1, "must not duplicate by name");
  assert.deepEqual(reactEntries[0].evidence, ["manual"], "manual entry wins on name collision");
});

// --- Repository -------------------------------------------------------------

test("Repository metadata change detected (branch)", () => {
  const p = project({ defaultBranch: "main" });
  const diff = compareRepository(p, repo({ defaultBranch: "master" }));
  assert.equal(diff.changed, true);
  assert.equal(diff.current.defaultBranch, "main");
  assert.equal(diff.incoming.defaultBranch, "master");
});

test("Repository metadata unchanged", () => {
  const p = project({ githubOwner: "acme", githubRepo: "widgets", defaultBranch: "main" });
  const diff = compareRepository(p, repo({ owner: "acme", name: "widgets", defaultBranch: "main" }));
  assert.equal(diff.changed, false);
});

// --- Setup guide ------------------------------------------------------------

function setupGuide(content: string): SetupGuideData {
  return { title: "Setup Guide", category: "SETUP", filePath: "[generated]/SETUP_GUIDE.md", content, source: "generated", evidence: [] };
}

test("12. Unmodified generated guide can safely be regenerated", () => {
  const content = "# Setup Guide\n\noriginal content";
  const stored = doc({
    source: "generated",
    filePath: "[generated]/SETUP_GUIDE.md",
    content,
    generatedFromContentHash: sha256(content),
  });
  const diff = compareSetupGuide(stored, setupGuide("# Setup Guide\n\nfresh regenerated content"));
  assert.equal(diff.userModified, false);
  assert.equal(diff.changed, true);
});

test("13. Manually modified generated guide is protected", () => {
  const originalContent = "# Setup Guide\n\noriginal content";
  const editedContent = "# Setup Guide\n\noriginal content\n\n## My manual note";
  const stored = doc({
    source: "generated",
    filePath: "[generated]/SETUP_GUIDE.md",
    content: editedContent,
    generatedFromContentHash: sha256(originalContent), // hash reflects the PRE-edit content
  });
  const diff = compareSetupGuide(stored, setupGuide("# Setup Guide\n\nfresh regenerated content"));
  assert.equal(diff.userModified, true, "hash mismatch must signal user modification");
});

test("No stored generated guide -> not user modified, available for first generation", () => {
  const diff = compareSetupGuide(null, setupGuide("# Setup Guide"));
  assert.equal(diff.exists, false);
  assert.equal(diff.userModified, false);
  assert.equal(diff.changed, true);
});

test("Legacy generated doc with no hash defaults to not-user-modified (safe to regen)", () => {
  const stored = doc({ source: "generated", filePath: "[generated]/SETUP_GUIDE.md", content: "whatever", generatedFromContentHash: null });
  const diff = compareSetupGuide(stored, setupGuide("fresh content"));
  assert.equal(diff.userModified, false);
});

test("14. Native SETUP.md (source=github) is completely untouched by setup-guide comparison", () => {
  // Native SETUP.md lives in `documents`, not the generated-guide slot — confirm compareDocuments handles it
  // like any other github doc, and compareSetupGuide never looks at it.
  const nativeSetup = doc({ source: "github", filePath: "SETUP.md", category: "SETUP", content: "native content" });
  const diff = compareDocuments([nativeSetup], [githubDoc({ filePath: "SETUP.md", category: "SETUP", content: "native content" })]);
  assert.equal(diff.unchanged.length, 1);

  const setupDiff = compareSetupGuide(null, setupGuide("generated content"));
  assert.equal(setupDiff.exists, false, "native SETUP.md must not be picked up as the generated guide");
});
