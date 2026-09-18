import type { Technology, TechnologyCategory } from "@/types/technology";
import type { FileDetectionRule } from "@/lib/github/technology/types";

function tech(name: string, category: TechnologyCategory, evidence: string): Technology {
  return { name, category, evidence: [evidence], confidence: "HIGH" };
}

function findFiles(files: Record<string, string>, matches: (path: string) => boolean): string[] {
  return Object.keys(files).filter(matches);
}

function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

// ---------------------------------------------------------------------------
// JavaScript / TypeScript (package.json)
// ---------------------------------------------------------------------------

const JS_DEPENDENCY_MAP: Record<string, { name: string; category: TechnologyCategory }> = {
  next: { name: "Next.js", category: "FRAMEWORK" },
  react: { name: "React", category: "FRAMEWORK" },
  "react-dom": { name: "React", category: "FRAMEWORK" },
  vue: { name: "Vue", category: "FRAMEWORK" },
  "@angular/core": { name: "Angular", category: "FRAMEWORK" },
  svelte: { name: "Svelte", category: "FRAMEWORK" },
  express: { name: "Express", category: "FRAMEWORK" },
  fastify: { name: "Fastify", category: "FRAMEWORK" },
  "@nestjs/core": { name: "NestJS", category: "FRAMEWORK" },
  vite: { name: "Vite", category: "TOOL" },
  typescript: { name: "TypeScript", category: "LANGUAGE" },
  prisma: { name: "Prisma", category: "LIBRARY" },
  "@prisma/client": { name: "Prisma", category: "LIBRARY" },
  pg: { name: "PostgreSQL", category: "DATABASE" },
  postgres: { name: "PostgreSQL", category: "DATABASE" },
  mysql: { name: "MySQL", category: "DATABASE" },
  mysql2: { name: "MySQL", category: "DATABASE" },
  mongodb: { name: "MongoDB", category: "DATABASE" },
  mongoose: { name: "MongoDB", category: "DATABASE" },
  sqlite3: { name: "SQLite", category: "DATABASE" },
  "better-sqlite3": { name: "SQLite", category: "DATABASE" },
  "aws-sdk": { name: "AWS", category: "CLOUD" },
  vercel: { name: "Vercel", category: "CLOUD" },
  openai: { name: "OpenAI", category: "AI_ML" },
  langchain: { name: "LangChain", category: "AI_ML" },
};

const JS_DEPENDENCY_PREFIX_MAP: Array<{ prefix: string; name: string; category: TechnologyCategory }> = [
  { prefix: "@azure/openai", name: "Azure OpenAI", category: "AI_ML" },
  { prefix: "@azure/", name: "Azure", category: "CLOUD" },
  { prefix: "@aws-sdk/", name: "AWS", category: "CLOUD" },
  { prefix: "@google-cloud/", name: "Google Cloud", category: "CLOUD" },
];

function readPackageJsonDeps(content: string): string[] {
  try {
    const data = JSON.parse(content) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return [...Object.keys(data.dependencies ?? {}), ...Object.keys(data.devDependencies ?? {})];
  } catch {
    return [];
  }
}

export const detectFromPackageJson: FileDetectionRule = (files) => {
  const paths = findFiles(files, (p) => basename(p) === "package.json");
  const results: Technology[] = [];

  for (const path of paths) {
    results.push(tech("Node.js", "RUNTIME", path));

    for (const depName of readPackageJsonDeps(files[path])) {
      const direct = JS_DEPENDENCY_MAP[depName];
      if (direct) {
        results.push(tech(direct.name, direct.category, path));
        continue;
      }
      const prefixed = JS_DEPENDENCY_PREFIX_MAP.find((p) => depName.startsWith(p.prefix));
      if (prefixed) {
        results.push(tech(prefixed.name, prefixed.category, path));
      }
    }
  }

  return results;
};

// ---------------------------------------------------------------------------
// JS/TS config files (secondary confirmation — package.json is primary)
// ---------------------------------------------------------------------------

export const detectFromJsConfigFiles: FileDetectionRule = (files) => {
  const results: Technology[] = [];
  for (const path of Object.keys(files)) {
    const base = basename(path).toLowerCase();
    if (base === "tsconfig.json") results.push(tech("TypeScript", "LANGUAGE", path));
    if (/^next\.config\.(js|mjs|ts|cjs)$/.test(base)) results.push(tech("Next.js", "FRAMEWORK", path));
    if (/^vite\.config\.(js|mjs|ts|cjs)$/.test(base)) results.push(tech("Vite", "TOOL", path));
    if (base === "angular.json") results.push(tech("Angular", "FRAMEWORK", path));
  }
  return results;
};

// ---------------------------------------------------------------------------
// Python
// ---------------------------------------------------------------------------

const PYTHON_PACKAGE_MAP: Record<string, { name: string; category: TechnologyCategory }> = {
  fastapi: { name: "FastAPI", category: "FRAMEWORK" },
  django: { name: "Django", category: "FRAMEWORK" },
  flask: { name: "Flask", category: "FRAMEWORK" },
  pydantic: { name: "Pydantic", category: "LIBRARY" },
  sqlalchemy: { name: "SQLAlchemy", category: "LIBRARY" },
  pandas: { name: "Pandas", category: "LIBRARY" },
  numpy: { name: "NumPy", category: "LIBRARY" },
  "scikit-learn": { name: "scikit-learn", category: "AI_ML" },
  sklearn: { name: "scikit-learn", category: "AI_ML" },
  torch: { name: "PyTorch", category: "AI_ML" },
  pytorch: { name: "PyTorch", category: "AI_ML" },
  tensorflow: { name: "TensorFlow", category: "AI_ML" },
  transformers: { name: "Transformers", category: "AI_ML" },
  langchain: { name: "LangChain", category: "AI_ML" },
  openai: { name: "OpenAI", category: "AI_ML" },
  psycopg2: { name: "PostgreSQL", category: "DATABASE" },
  "psycopg2-binary": { name: "PostgreSQL", category: "DATABASE" },
  psycopg: { name: "PostgreSQL", category: "DATABASE" },
  pymongo: { name: "MongoDB", category: "DATABASE" },
  pymysql: { name: "MySQL", category: "DATABASE" },
  mysqlclient: { name: "MySQL", category: "DATABASE" },
  "mysql-connector-python": { name: "MySQL", category: "DATABASE" },
  boto3: { name: "AWS", category: "CLOUD" },
};

const PYTHON_MANIFEST_NAMES = new Set(["requirements.txt", "pyproject.toml", "pipfile"]);

export const detectFromPythonManifests: FileDetectionRule = (files) => {
  const paths = findFiles(files, (p) => PYTHON_MANIFEST_NAMES.has(basename(p).toLowerCase()));
  if (paths.length === 0) return [];

  const results: Technology[] = [tech("Python", "LANGUAGE", paths[0])];

  for (const path of paths) {
    const content = files[path];
    for (const [pkg, def] of Object.entries(PYTHON_PACKAGE_MAP)) {
      const pattern = new RegExp(`(^|[^a-z0-9_.-])${pkg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9_.-]|$)`, "i");
      if (pattern.test(content)) {
        results.push(tech(def.name, def.category, path));
      }
    }
    if (/\bazure-[a-z0-9-]+/i.test(content)) results.push(tech("Azure", "CLOUD", path));
    if (/\bgoogle-cloud-[a-z0-9-]+/i.test(content)) results.push(tech("Google Cloud", "CLOUD", path));
  }

  return results;
};

export const detectFromManagePy: FileDetectionRule = (files) => {
  const paths = findFiles(files, (p) => basename(p).toLowerCase() === "manage.py");
  if (paths.length === 0) return [];
  return [tech("Python", "LANGUAGE", paths[0]), tech("Django", "FRAMEWORK", paths[0])];
};

// ---------------------------------------------------------------------------
// .NET
// ---------------------------------------------------------------------------

export const detectFromDotNet: FileDetectionRule = (files) => {
  const projectFiles = findFiles(files, (p) => /\.(csproj|sln)$/i.test(p));
  if (projectFiles.length === 0) return [];

  const results: Technology[] = [tech(".NET", "RUNTIME", projectFiles[0])];

  for (const path of projectFiles) {
    const content = files[path];
    if (/Sdk\s*=\s*"Microsoft\.NET\.Sdk\.Web"/i.test(content) || /Microsoft\.AspNetCore/i.test(content)) {
      results.push(tech("ASP.NET Core", "FRAMEWORK", path));
    }
    if (/Microsoft\.EntityFrameworkCore/i.test(content)) {
      results.push(tech("Entity Framework Core", "LIBRARY", path));
    }
  }

  return results;
};

// ---------------------------------------------------------------------------
// Go / Rust / Java (basic, presence-based — not exhaustive)
// ---------------------------------------------------------------------------

export const detectFromGoMod: FileDetectionRule = (files) => {
  const paths = findFiles(files, (p) => basename(p) === "go.mod");
  return paths.length > 0 ? [tech("Go", "LANGUAGE", paths[0])] : [];
};

export const detectFromCargoToml: FileDetectionRule = (files) => {
  const paths = findFiles(files, (p) => basename(p) === "Cargo.toml");
  return paths.length > 0 ? [tech("Rust", "LANGUAGE", paths[0])] : [];
};

export const detectFromMaven: FileDetectionRule = (files) => {
  const paths = findFiles(files, (p) => basename(p) === "pom.xml");
  if (paths.length === 0) return [];
  return [tech("Java", "LANGUAGE", paths[0]), tech("Maven", "TOOL", paths[0])];
};

export const detectFromGradle: FileDetectionRule = (files) => {
  const paths = findFiles(files, (p) => /^build\.gradle(\.kts)?$/.test(basename(p)));
  if (paths.length === 0) return [];
  return [tech("Java", "LANGUAGE", paths[0]), tech("Gradle", "TOOL", paths[0])];
};

// ---------------------------------------------------------------------------
// Database — Prisma schema datasource provider
// ---------------------------------------------------------------------------

const PRISMA_PROVIDER_MAP: Record<string, string> = {
  sqlite: "SQLite",
  postgresql: "PostgreSQL",
  postgres: "PostgreSQL",
  mysql: "MySQL",
  mongodb: "MongoDB",
  sqlserver: "SQL Server",
  cockroachdb: "CockroachDB",
};

export const detectFromPrismaSchema: FileDetectionRule = (files) => {
  const paths = findFiles(files, (p) => p.toLowerCase().endsWith("prisma/schema.prisma"));
  const results: Technology[] = [];

  for (const path of paths) {
    results.push(tech("Prisma", "LIBRARY", path));
    const match = files[path].match(/datasource\s+\w+\s*{[^}]*provider\s*=\s*"(\w+)"/i);
    const dbName = match ? PRISMA_PROVIDER_MAP[match[1].toLowerCase()] : undefined;
    if (dbName) {
      results.push(tech(dbName, "DATABASE", path));
    }
  }

  return results;
};

// ---------------------------------------------------------------------------
// Vercel config (file-based, in addition to the "vercel" package rule above)
// ---------------------------------------------------------------------------

export const detectFromVercelConfig: FileDetectionRule = (files) => {
  const paths = findFiles(files, (p) => basename(p) === "vercel.json");
  return paths.length > 0 ? [tech("Vercel", "CLOUD", paths[0])] : [];
};

export const FILE_DETECTION_RULES: FileDetectionRule[] = [
  detectFromPackageJson,
  detectFromJsConfigFiles,
  detectFromPythonManifests,
  detectFromManagePy,
  detectFromDotNet,
  detectFromGoMod,
  detectFromCargoToml,
  detectFromMaven,
  detectFromGradle,
  detectFromPrismaSchema,
  detectFromVercelConfig,
];

// ---------------------------------------------------------------------------
// README (secondary evidence only — never overrides/duplicates file evidence)
// ---------------------------------------------------------------------------

// Technology names worth searching for in README prose. Deliberately excludes
// generic English words prone to false positives (e.g. "Go" the language).
export const README_SEARCHABLE_TECHNOLOGIES: Array<{ name: string; category: TechnologyCategory }> = [
  { name: "Next.js", category: "FRAMEWORK" },
  { name: "React", category: "FRAMEWORK" },
  { name: "Vue", category: "FRAMEWORK" },
  { name: "Angular", category: "FRAMEWORK" },
  { name: "Svelte", category: "FRAMEWORK" },
  { name: "Express", category: "FRAMEWORK" },
  { name: "Fastify", category: "FRAMEWORK" },
  { name: "NestJS", category: "FRAMEWORK" },
  { name: "Vite", category: "TOOL" },
  { name: "TypeScript", category: "LANGUAGE" },
  { name: "FastAPI", category: "FRAMEWORK" },
  { name: "Django", category: "FRAMEWORK" },
  { name: "Flask", category: "FRAMEWORK" },
  { name: "Pandas", category: "LIBRARY" },
  { name: "NumPy", category: "LIBRARY" },
  { name: "scikit-learn", category: "AI_ML" },
  { name: "PyTorch", category: "AI_ML" },
  { name: "TensorFlow", category: "AI_ML" },
  { name: "LangChain", category: "AI_ML" },
  { name: "OpenAI", category: "AI_ML" },
  { name: "Rust", category: "LANGUAGE" },
  { name: "Java", category: "LANGUAGE" },
  { name: ".NET", category: "RUNTIME" },
  { name: "ASP.NET Core", category: "FRAMEWORK" },
  { name: "PostgreSQL", category: "DATABASE" },
  { name: "MySQL", category: "DATABASE" },
  { name: "MongoDB", category: "DATABASE" },
  { name: "SQLite", category: "DATABASE" },
  { name: "Azure", category: "CLOUD" },
  { name: "AWS", category: "CLOUD" },
  { name: "Google Cloud", category: "CLOUD" },
  { name: "Vercel", category: "CLOUD" },
  { name: "Prisma", category: "LIBRARY" },
];

export function detectFromReadme(readmeContent: string): Technology[] {
  if (!readmeContent) return [];
  const results: Technology[] = [];

  for (const { name, category } of README_SEARCHABLE_TECHNOLOGIES) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Word boundary on both ends; reject a trailing hyphen so "React-style"
    // or "Vue-inspired" hedging language doesn't count as a real mention.
    const pattern = new RegExp(`(^|[^a-z0-9])${escaped}(?!-)(?![a-z0-9])`, "i");
    if (pattern.test(readmeContent)) {
      results.push({ name, category, evidence: ["README.md"], confidence: "MEDIUM" });
    }
  }

  return results;
}
