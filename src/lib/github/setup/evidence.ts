import { isIgnoredPath, isSensitiveFile } from "@/lib/github/documents";
import type { EnvVariableInfo, EvidencedCommand, SetupEvidence } from "@/lib/github/setup/types";

function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

// ---------------------------------------------------------------------------
// Candidate file selection (what to fetch from the tree)
// ---------------------------------------------------------------------------

const ENV_TEMPLATE_FILENAMES = new Set([".env.example", ".env.sample", ".env.template", "env.example"]);

/** Explicitly allowed .env-shaped files — real .env* files stay blocked by isSensitiveFile. */
export function isEnvTemplateFile(path: string): boolean {
  return ENV_TEMPLATE_FILENAMES.has(basename(path).toLowerCase());
}

const SETUP_EXACT_FILENAMES = new Set([
  "package.json",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  "bun.lock",
  "tsconfig.json",
  "angular.json",
  "requirements.txt",
  "pipfile",
  "pipfile.lock",
  "pyproject.toml",
  "setup.py",
  "setup.cfg",
  "manage.py",
  "global.json",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "gradlew",
  "gradlew.bat",
  "gradle-wrapper.properties",
  "go.mod",
  "cargo.toml",
]);

/** Whether a repository tree path is worth fetching for setup-guide evidence. */
export function isSetupEvidenceCandidate(path: string): boolean {
  if (isIgnoredPath(path)) return false;
  if (isSensitiveFile(path) && !isEnvTemplateFile(path)) return false;

  const base = basename(path).toLowerCase();
  if (SETUP_EXACT_FILENAMES.has(base)) return true;
  if (isEnvTemplateFile(path)) return true;
  if (/\.(csproj|sln)$/i.test(base)) return true;
  if (/^next\.config\.(js|mjs|ts|cjs)$/.test(base)) return true;
  if (/^vite\.config\.(js|mjs|ts|cjs)$/.test(base)) return true;
  if (/^requirements\/.*\.txt$/i.test(path.replace(/\\/g, "/"))) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Small shared helpers
// ---------------------------------------------------------------------------

function findFiles(files: Record<string, string>, matches: (path: string) => boolean): string[] {
  return Object.keys(files).filter(matches);
}

function evidence(filePath: string, reason: string): SetupEvidence {
  return { filePath, reason };
}

// ---------------------------------------------------------------------------
// Node / JavaScript / TypeScript
// ---------------------------------------------------------------------------

export interface PackageManagerInfo {
  name: string;
  installCommand: string;
  evidence: SetupEvidence;
}

const LOCKFILE_PACKAGE_MANAGERS: Array<{ file: string; name: string; install: string }> = [
  { file: "pnpm-lock.yaml", name: "pnpm", install: "pnpm install" },
  { file: "yarn.lock", name: "yarn", install: "yarn install" },
  { file: "package-lock.json", name: "npm", install: "npm install" },
  { file: "bun.lockb", name: "bun", install: "bun install" },
  { file: "bun.lock", name: "bun", install: "bun install" },
];

const README_PM_HINTS: Array<{ pattern: RegExp; name: string; install: string }> = [
  { pattern: /\bpnpm install\b/i, name: "pnpm", install: "pnpm install" },
  { pattern: /\byarn install\b/i, name: "yarn", install: "yarn install" },
  { pattern: /\bbun install\b/i, name: "bun", install: "bun install" },
  { pattern: /\bnpm install\b/i, name: "npm", install: "npm install" },
];

/** Determines the Node package manager from lockfile evidence, falling back to README mentions. */
export function detectPackageManager(files: Record<string, string>, docText: string): PackageManagerInfo | null {
  for (const candidate of LOCKFILE_PACKAGE_MANAGERS) {
    const path = findFiles(files, (p) => basename(p).toLowerCase() === candidate.file)[0];
    if (path) {
      return {
        name: candidate.name,
        installCommand: candidate.install,
        evidence: evidence(path, `${candidate.name} lockfile detected`),
      };
    }
  }

  for (const hint of README_PM_HINTS) {
    if (hint.pattern.test(docText)) {
      return {
        name: hint.name,
        installCommand: hint.install,
        evidence: evidence("README.md", `${hint.name} install command mentioned in README`),
      };
    }
  }

  return null;
}

function runScript(pm: string, scriptName: string): string {
  return scriptName === "start" || scriptName === "test" ? `${pm} ${scriptName}` : `${pm} run ${scriptName}`;
}

export interface NodeFacts {
  hasPackageJson: boolean;
  packageJsonPath: string | null;
  scripts: Record<string, string>;
  engineNode: string | null;
  runCommands: EvidencedCommand[];
  buildCommands: EvidencedCommand[];
  testCommands: EvidencedCommand[];
  lintCommands: EvidencedCommand[];
  configFiles: string[];
  scriptPorts: { port: string; evidence: SetupEvidence }[];
}

function extractPortsFromScriptValue(scriptValue: string): string[] {
  const ports: string[] = [];
  const patterns = [/(?:-p|--port)[= ](\d{2,5})/i, /\bPORT=(\d{2,5})/];
  for (const pattern of patterns) {
    const match = scriptValue.match(pattern);
    if (match) ports.push(match[1]);
  }
  return ports;
}

export function detectNodeFacts(files: Record<string, string>, packageManagerName: string | null): NodeFacts {
  const packageJsonPath = findFiles(files, (p) => basename(p) === "package.json")[0] ?? null;
  const pm = packageManagerName ?? "npm";

  let scripts: Record<string, string> = {};
  let engineNode: string | null = null;

  if (packageJsonPath) {
    try {
      const data = JSON.parse(files[packageJsonPath]) as {
        scripts?: Record<string, string>;
        engines?: { node?: string };
      };
      scripts = data.scripts ?? {};
      engineNode = data.engines?.node ?? null;
    } catch {
      // malformed package.json — nothing we can safely extract
    }
  }

  const runCommands: EvidencedCommand[] = [];
  const buildCommands: EvidencedCommand[] = [];
  const testCommands: EvidencedCommand[] = [];
  const lintCommands: EvidencedCommand[] = [];
  const scriptPorts: { port: string; evidence: SetupEvidence }[] = [];

  if (scripts.dev) {
    runCommands.push({ command: runScript(pm, "dev"), evidence: evidence(packageJsonPath!, "scripts.dev") });
  }
  if (scripts.start) {
    runCommands.push({ command: runScript(pm, "start"), evidence: evidence(packageJsonPath!, "scripts.start") });
  }
  if (scripts.build) {
    buildCommands.push({ command: runScript(pm, "build"), evidence: evidence(packageJsonPath!, "scripts.build") });
  }
  if (scripts.test) {
    testCommands.push({ command: runScript(pm, "test"), evidence: evidence(packageJsonPath!, "scripts.test") });
  }
  if (scripts.lint) {
    lintCommands.push({ command: runScript(pm, "lint"), evidence: evidence(packageJsonPath!, "scripts.lint") });
  }

  for (const [name, value] of Object.entries(scripts)) {
    for (const port of extractPortsFromScriptValue(value)) {
      scriptPorts.push({ port, evidence: evidence(packageJsonPath!, `scripts.${name}`) });
    }
  }

  const configFiles = findFiles(
    files,
    (p) =>
      basename(p) === "tsconfig.json" ||
      basename(p) === "angular.json" ||
      /^next\.config\.(js|mjs|ts|cjs)$/.test(basename(p)) ||
      /^vite\.config\.(js|mjs|ts|cjs)$/.test(basename(p)),
  );

  return {
    hasPackageJson: packageJsonPath !== null,
    packageJsonPath,
    scripts,
    engineNode,
    runCommands,
    buildCommands,
    testCommands,
    lintCommands,
    configFiles,
    scriptPorts,
  };
}

// ---------------------------------------------------------------------------
// Python
// ---------------------------------------------------------------------------

export interface PythonFacts {
  detected: boolean;
  installCommand: EvidencedCommand | null;
  installMethodUnknown: boolean;
  pythonVersion: { value: string; evidence: SetupEvidence } | null;
  isDjango: boolean;
  runCommands: EvidencedCommand[];
  testCommands: EvidencedCommand[];
}

export function detectPythonFacts(files: Record<string, string>, docText: string): PythonFacts {
  const requirementsPaths = findFiles(
    files,
    (p) => basename(p).toLowerCase() === "requirements.txt" || /^requirements\/.*\.txt$/i.test(p),
  );
  const pipfilePath = findFiles(files, (p) => basename(p).toLowerCase() === "pipfile")[0];
  const pyprojectPath = findFiles(files, (p) => basename(p).toLowerCase() === "pyproject.toml")[0];
  const setupPyPath = findFiles(files, (p) => basename(p).toLowerCase() === "setup.py")[0];
  const managePyPath = findFiles(files, (p) => basename(p).toLowerCase() === "manage.py")[0];

  const detected = Boolean(
    requirementsPaths.length || pipfilePath || pyprojectPath || setupPyPath || managePyPath,
  );

  let installCommand: EvidencedCommand | null = null;
  let installMethodUnknown = false;

  if (requirementsPaths.length > 0) {
    installCommand = {
      command: requirementsPaths.map((p) => `pip install -r ${p}`).join("\n"),
      evidence: evidence(requirementsPaths[0], "requirements.txt present"),
    };
  } else if (pipfilePath) {
    installCommand = { command: "pipenv install", evidence: evidence(pipfilePath, "Pipfile present") };
  } else if (pyprojectPath && /\[tool\.poetry\]/.test(files[pyprojectPath])) {
    installCommand = {
      command: "poetry install",
      evidence: evidence(pyprojectPath, "[tool.poetry] section present"),
    };
  } else if (setupPyPath) {
    installCommand = { command: "pip install -e .", evidence: evidence(setupPyPath, "setup.py present") };
  } else if (detected) {
    installMethodUnknown = true;
  }

  let pythonVersion: { value: string; evidence: SetupEvidence } | null = null;
  if (pyprojectPath) {
    const poetryMatch = files[pyprojectPath].match(/python\s*=\s*"([^"]+)"/);
    const pep621Match = files[pyprojectPath].match(/requires-python\s*=\s*"([^"]+)"/);
    const match = poetryMatch ?? pep621Match;
    if (match) {
      pythonVersion = { value: match[1], evidence: evidence(pyprojectPath, "Python version constraint") };
    }
  }
  if (!pythonVersion && pipfilePath) {
    const match = files[pipfilePath].match(/python_version\s*=\s*"([^"]+)"/);
    if (match) {
      pythonVersion = { value: match[1], evidence: evidence(pipfilePath, "[requires] python_version") };
    }
  }

  const isDjango = Boolean(managePyPath);
  const runCommands: EvidencedCommand[] = [];
  const testCommands: EvidencedCommand[] = [];

  if (isDjango) {
    runCommands.push({
      command: `python ${managePyPath} runserver`,
      evidence: evidence(managePyPath, "manage.py present (Django)"),
    });
    testCommands.push({
      command: `python ${managePyPath} test`,
      evidence: evidence(managePyPath, "manage.py present (Django)"),
    });
  } else {
    const runHint = docText.match(/\b(uvicorn\s+[\w.:]+(?:\s+--reload)?|flask run|gunicorn\s+[\w.:]+)\b/i);
    if (runHint) {
      runCommands.push({ command: runHint[1], evidence: evidence("README.md", "run command mentioned in README") });
    }
  }

  return { detected, installCommand, installMethodUnknown, pythonVersion, isDjango, runCommands, testCommands };
}

// ---------------------------------------------------------------------------
// .NET
// ---------------------------------------------------------------------------

export interface DotNetFacts {
  detected: boolean;
  sdkVersion: { value: string; evidence: SetupEvidence } | null;
  isAspNetCore: boolean;
  evidencePath: string | null;
}

export function detectDotNetFacts(files: Record<string, string>): DotNetFacts {
  const projectPaths = findFiles(files, (p) => /\.(csproj|sln)$/i.test(p));
  const globalJsonPath = findFiles(files, (p) => basename(p).toLowerCase() === "global.json")[0];

  let sdkVersion: { value: string; evidence: SetupEvidence } | null = null;
  if (globalJsonPath) {
    try {
      const data = JSON.parse(files[globalJsonPath]) as { sdk?: { version?: string } };
      if (data.sdk?.version) {
        sdkVersion = {
          value: data.sdk.version,
          evidence: evidence(globalJsonPath, "sdk.version in global.json"),
        };
      }
    } catch {
      // malformed global.json — skip
    }
  }

  const isAspNetCore = projectPaths.some(
    (p) => /Sdk\s*=\s*"Microsoft\.NET\.Sdk\.Web"/i.test(files[p]) || /Microsoft\.AspNetCore/i.test(files[p]),
  );

  return {
    detected: projectPaths.length > 0,
    sdkVersion,
    isAspNetCore,
    evidencePath: projectPaths[0] ?? null,
  };
}

// ---------------------------------------------------------------------------
// Java (Maven / Gradle)
// ---------------------------------------------------------------------------

export interface JavaFacts {
  detected: boolean;
  buildTool: "maven" | "gradle" | null;
  hasGradleWrapper: boolean;
  javaVersion: { value: string; evidence: SetupEvidence } | null;
  isSpringBoot: boolean;
  evidencePath: string | null;
}

export function detectJavaFacts(files: Record<string, string>): JavaFacts {
  const pomPath = findFiles(files, (p) => basename(p).toLowerCase() === "pom.xml")[0];
  const gradlePath = findFiles(files, (p) => /^build\.gradle(\.kts)?$/.test(basename(p)))[0];
  const hasGradleWrapper = findFiles(files, (p) => basename(p).toLowerCase() === "gradlew").length > 0;

  if (!pomPath && !gradlePath) {
    return { detected: false, buildTool: null, hasGradleWrapper, javaVersion: null, isSpringBoot: false, evidencePath: null };
  }

  const buildTool: "maven" | "gradle" = pomPath ? "maven" : "gradle";
  const path = pomPath ?? gradlePath!;
  const content = files[path];

  let javaVersion: { value: string; evidence: SetupEvidence } | null = null;
  const mavenMatch = content.match(/<maven\.compiler\.(?:source|release)>(\d+)</);
  const gradleMatch = content.match(/sourceCompatibility\s*=\s*['"]?(?:JavaVersion\.VERSION_)?(\d+)['"]?/);
  const match = mavenMatch ?? gradleMatch;
  if (match) {
    javaVersion = { value: match[1], evidence: evidence(path, "Java version configuration") };
  }

  const isSpringBoot = /spring-boot/i.test(content);

  return { detected: true, buildTool, hasGradleWrapper, javaVersion, isSpringBoot, evidencePath: path };
}

// ---------------------------------------------------------------------------
// Go / Rust (basic — presence-based, not exhaustive)
// ---------------------------------------------------------------------------

export function detectGoModPath(files: Record<string, string>): string | null {
  return findFiles(files, (p) => basename(p) === "go.mod")[0] ?? null;
}

export function detectCargoTomlPath(files: Record<string, string>): string | null {
  return findFiles(files, (p) => basename(p) === "Cargo.toml")[0] ?? null;
}

// ---------------------------------------------------------------------------
// Environment variables (names only — never values)
// ---------------------------------------------------------------------------

export function detectEnvVariables(
  files: Record<string, string>,
  docText: string,
): { variables: EnvVariableInfo[]; evidencePaths: string[] } {
  const envPaths = findFiles(files, isEnvTemplateFile);
  const names = new Set<string>();

  for (const path of envPaths) {
    for (const line of files[path].split("\n")) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
      if (match) names.add(match[1]);
    }
  }

  const variables: EnvVariableInfo[] = [...names].map((name) => {
    const nameRegex = new RegExp(`\\b${name}\\b[^\\n]*`, "i");
    const line = docText.match(nameRegex)?.[0] ?? "";
    let requirement: EnvVariableInfo["requirement"] = "UNKNOWN";
    if (/required/i.test(line)) requirement = "REQUIRED";
    else if (/optional/i.test(line)) requirement = "OPTIONAL";
    return { name, requirement };
  });

  return { variables, evidencePaths: envPaths };
}

// ---------------------------------------------------------------------------
// Ports
// ---------------------------------------------------------------------------

export function detectPortsFromText(docText: string): { port: string; evidence: SetupEvidence }[] {
  const results: { port: string; evidence: SetupEvidence }[] = [];
  const seen = new Set<string>();
  const patterns = [
    /\bPORT\s*=\s*(\d{2,5})\b/g,
    /\blocalhost:(\d{2,5})\b/g,
    /\b127\.0\.0\.1:(\d{2,5})\b/g,
    /\bserver\.port\s*=\s*(\d{2,5})\b/g,
  ];
  for (const pattern of patterns) {
    for (const match of docText.matchAll(pattern)) {
      const port = match[1];
      if (!seen.has(port)) {
        seen.add(port);
        results.push({ port, evidence: evidence("README.md", "port mentioned in documentation") });
      }
    }
  }
  return results;
}
