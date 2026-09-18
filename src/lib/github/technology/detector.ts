import type { Technology } from "@/types/technology";
import type { DetectionInput } from "@/lib/github/technology/types";
import { FILE_DETECTION_RULES, detectFromReadme } from "@/lib/github/technology/rules";

function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

/** Whether a repository tree path is worth fetching for technology detection. */
export function isTechDetectionCandidate(path: string): boolean {
  const base = basename(path);
  const baseLower = base.toLowerCase();

  const exactNames = new Set([
    "package.json",
    "requirements.txt",
    "pyproject.toml",
    "pipfile",
    "manage.py",
    "go.mod",
    "cargo.toml",
    "pom.xml",
    "build.gradle",
    "build.gradle.kts",
    "tsconfig.json",
    "angular.json",
    "vercel.json",
  ]);
  if (exactNames.has(baseLower)) return true;

  if (/\.(csproj|sln)$/i.test(base)) return true;
  if (/^next\.config\.(js|mjs|ts|cjs)$/.test(baseLower)) return true;
  if (/^vite\.config\.(js|mjs|ts|cjs)$/.test(baseLower)) return true;
  if (path.toLowerCase().endsWith("prisma/schema.prisma")) return true;

  return false;
}

/** Cap on how many detection-candidate files get fetched per import. */
export const MAX_TECH_DETECTION_FILES = 20;

function mergeByName(candidates: Technology[]): Technology[] {
  const byKey = new Map<string, Technology>();

  for (const candidate of candidates) {
    const key = candidate.name.toLowerCase();
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...candidate, evidence: [...candidate.evidence] });
      continue;
    }
    for (const file of candidate.evidence) {
      if (!existing.evidence.includes(file)) existing.evidence.push(file);
    }
    if (candidate.confidence === "HIGH") existing.confidence = "HIGH";
  }

  return [...byKey.values()];
}

/**
 * Deterministic, rule-based technology detection. No LLM. Takes already-fetched
 * file contents + README text and returns a deduplicated, evidence-backed list.
 */
export function detectTechnologies(input: DetectionInput): Technology[] {
  const fileCandidates = FILE_DETECTION_RULES.flatMap((rule) => rule(input.files));
  const merged = mergeByName(fileCandidates);

  const knownNames = new Set(merged.map((t) => t.name.toLowerCase()));
  const readmeOnly = mergeByName(
    detectFromReadme(input.readmeContent).filter((t) => !knownNames.has(t.name.toLowerCase())),
  );

  return [...merged, ...readmeOnly].sort(
    (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
  );
}
