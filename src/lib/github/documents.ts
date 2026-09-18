import type { DocumentCategory } from "@/types/documentation";

/** Maximum size (bytes) of a single documentation file we'll fetch. */
export const MAX_DOC_FILE_BYTES = 1_000_000; // 1 MB

const IGNORED_DIR_NAMES = new Set([".git", "node_modules", ".next", "dist", "build", "coverage"]);

const BINARY_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "ico",
  "mp4",
  "mov",
  "avi",
  "zip",
  "tar",
  "gz",
]);

const SENSITIVE_FILENAMES = new Set(["credentials.json", "secrets.json"]);
const SENSITIVE_EXTENSIONS = new Set(["pem", "key"]);

// Root-level filenames (case-insensitive) that are recognized as documentation
// even outside docs/ or documentation/. README.md is handled separately —
// it's already fetched during Phase 2 import and reused, not re-fetched here.
const ROOT_DOC_FILENAMES = new Set([
  "architecture.md",
  "prd.md",
  "plan.md",
  "ai_rules.md",
  "setup.md",
  "design.md",
  "technical_design.md",
]);

const CLASSIFICATION_MAP: Record<string, DocumentCategory> = {
  readme: "README",
  setup: "SETUP",
  architecture: "ARCHITECTURE",
  prd: "PRD",
  plan: "PLAN",
  ai_rules: "AI_RULES",
  "ai-rules": "AI_RULES",
  design: "DESIGN",
  technical_design: "DESIGN",
  "technical-design": "DESIGN",
};

function baseName(path: string): string {
  return path.split("/").pop() ?? path;
}

function extension(path: string): string {
  const base = baseName(path);
  const dot = base.lastIndexOf(".");
  return dot === -1 ? "" : base.slice(dot + 1).toLowerCase();
}

/** Whether any path segment is an ignored directory (.git, node_modules, .next, dist, build, coverage). */
export function isIgnoredPath(path: string): boolean {
  return path.split("/").some((segment) => IGNORED_DIR_NAMES.has(segment));
}

function isBinaryFile(path: string): boolean {
  return BINARY_EXTENSIONS.has(extension(path));
}

/** Whether a path looks like a secret/credential file (.env*, keys, certs, credentials). */
export function isSensitiveFile(path: string): boolean {
  const base = baseName(path).toLowerCase();
  if (base.startsWith(".env")) return true;
  if (SENSITIVE_FILENAMES.has(base)) return true;
  if (SENSITIVE_EXTENSIONS.has(extension(path))) return true;
  return false;
}

/** Whether a repository tree path should be considered a documentation candidate. */
export function isDocCandidate(path: string): boolean {
  if (isIgnoredPath(path)) return false;
  if (isBinaryFile(path)) return false;
  if (isSensitiveFile(path)) return false;

  const lower = path.toLowerCase();
  const hasDir = lower.includes("/");
  const base = baseName(lower);

  if (!hasDir && base === "readme.md") return false;

  if (lower.startsWith("docs/") || lower.startsWith("documentation/")) {
    return base.endsWith(".md") || base.endsWith(".mdx") || base.endsWith(".txt");
  }

  if (!hasDir && ROOT_DOC_FILENAMES.has(base)) return true;

  return false;
}

/** Deterministic, filename-based classification — no LLM. */
export function classifyDocument(path: string): DocumentCategory {
  const base = baseName(path).toLowerCase().replace(/\.(md|mdx|txt)$/, "");
  return CLASSIFICATION_MAP[base] ?? "OTHER";
}

// Common short words that shouldn't be treated as acronyms (e.g. "help-in-depth" -> "Help In Depth", not "Help IN Depth").
const SHORT_STOPWORDS = new Set(["in", "to", "of", "on", "at", "is", "by", "or", "an", "as", "if"]);

function titleCaseWord(word: string): string {
  if (word.length <= 2 && !SHORT_STOPWORDS.has(word.toLowerCase())) return word.toUpperCase();
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/** Generates a human-readable title from a file path, e.g. AI_RULES.md -> "AI Rules". */
export function generateTitle(path: string): string {
  const base = baseName(path).replace(/\.(md|mdx|txt)$/i, "");
  const words = base.split(/[-_]+/).filter(Boolean);
  return words.length > 0 ? words.map(titleCaseWord).join(" ") : base;
}
