import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSetupGuide } from "@/lib/github/setup/builder";
import { isSetupEvidenceCandidate } from "@/lib/github/setup/evidence";
import { isTechDetectionCandidate } from "@/lib/github/technology/detector";
import type { GitHubRepository } from "@/types/github";
import type { Technology } from "@/types/technology";

function repo(overrides: Partial<GitHubRepository> = {}): GitHubRepository {
  return {
    name: "widgets",
    fullName: "acme/widgets",
    description: "A widget factory",
    htmlUrl: "https://github.com/acme/widgets",
    defaultBranch: "main",
    owner: "acme",
    ...overrides,
  };
}

function guide(files: Record<string, string>, readmeContent = "", technologies: Technology[] = []) {
  return buildSetupGuide({ repository: repo(), technologies, files, readmeContent });
}

function section(content: string, heading: string): string | null {
  const pattern = new RegExp(`## ${heading}\\n\\n([\\s\\S]*?)(?=\\n\\n## |$)`);
  return content.match(pattern)?.[1] ?? null;
}

// 1. Next.js repository
test("Next.js repository: dev/build/start commands from package.json, npm from lockfile", () => {
  const files = {
    "package.json": JSON.stringify({
      scripts: { dev: "next dev", build: "next build", start: "next start" },
      dependencies: { next: "16.0.0" },
    }),
    "package-lock.json": "{}",
  };
  const g = guide(files);
  assert.match(section(g.content, "8\\. Run the Project")!, /npm run dev/);
  assert.match(section(g.content, "9\\. Build")!, /npm run build/);
  assert.match(section(g.content, "5\\. Dependencies")!, /npm install/);
  assert.equal(g.source, "generated");
  assert.equal(g.filePath, "[generated]/SETUP_GUIDE.md");
});

// 2. React/Vite repository
test("Vite repository: dev command present, no dev script means no fabricated one", () => {
  const files = {
    "package.json": JSON.stringify({
      scripts: { dev: "vite", build: "vite build" },
      devDependencies: { vite: "^5.0.0" },
    }),
    "yarn.lock": "",
  };
  const g = guide(files);
  assert.match(section(g.content, "8\\. Run the Project")!, /yarn run dev/);
  assert.match(section(g.content, "5\\. Dependencies")!, /yarn install/);
});

// 3. Python requirements.txt
test("Python requirements.txt: pip install command with correct evidence", () => {
  const files = { "requirements.txt": "flask==2.0.0\n" };
  const g = guide(files);
  assert.match(section(g.content, "5\\. Dependencies")!, /pip install -r requirements\.txt/);
  assert.ok(g.evidence.some((e) => e.filePath === "requirements.txt"));
});

// 4. FastAPI-style project — no run command invented without evidence
test("FastAPI project: no run command fabricated without README/script evidence", () => {
  const files = { "requirements.txt": "fastapi==0.100.0\nuvicorn\n" };
  const g = guide(files);
  const runSection = section(g.content, "8\\. Run the Project");
  assert.match(runSection!, /Not identified from repository/);
});

test("FastAPI project: run command IS included when README explicitly documents it", () => {
  const files = { "requirements.txt": "fastapi==0.100.0\n" };
  const g = guide(files, "Start the server with:\n\nuvicorn main:app --reload\n");
  const runSection = section(g.content, "8\\. Run the Project");
  assert.match(runSection!, /uvicorn main:app --reload/);
});

// 5. Django project
test("Django project: manage.py implies runserver + test commands", () => {
  const files = { "manage.py": "#!/usr/bin/env python" };
  const g = guide(files);
  assert.match(section(g.content, "8\\. Run the Project")!, /python manage\.py runserver/);
  assert.match(section(g.content, "10\\. Tests")!, /python manage\.py test/);
});

// 6. .NET project
test(".NET project: restore/build/run/test from csproj presence", () => {
  const files = { "src/Api.csproj": `<Project Sdk="Microsoft.NET.Sdk.Web"></Project>` };
  const g = guide(files);
  assert.match(section(g.content, "5\\. Dependencies")!, /dotnet restore/);
  assert.match(section(g.content, "8\\. Run the Project")!, /dotnet run/);
  assert.match(section(g.content, "9\\. Build")!, /dotnet build/);
  assert.match(section(g.content, "10\\. Tests")!, /dotnet test/);
});

// 7. Java/Maven project
test("Java/Maven project: mvn commands from pom.xml presence", () => {
  const files = { "pom.xml": "<project></project>" };
  const g = guide(files);
  assert.match(section(g.content, "5\\. Dependencies")!, /mvn install/);
  assert.match(section(g.content, "9\\. Build")!, /mvn package/);
  assert.match(section(g.content, "10\\. Tests")!, /mvn test/);
  assert.equal(
    section(g.content, "8\\. Run the Project"),
    "Run command: Not identified from repository.",
    "Java is detected but no safe generic run command exists without spring-boot evidence",
  );
});

test("Java/Gradle + Spring Boot: bootRun only when spring-boot dependency evidenced", () => {
  const files = { "build.gradle": "dependencies { implementation 'org.springframework.boot:spring-boot-starter' }" };
  const g = guide(files);
  assert.match(section(g.content, "8\\. Run the Project")!, /gradle bootRun/);
});

// 8. Repository with .env.example
test("Repository with .env.example: variable names extracted, values never included", () => {
  const files = {
    "package.json": JSON.stringify({ scripts: { dev: "node index.js" } }),
    "package-lock.json": "{}",
    ".env.example": "DATABASE_URL=postgres://user:supersecret@localhost/db\nOPENAI_API_KEY=sk-fake\n",
  };
  const g = guide(files);
  const envSection = section(g.content, "6\\. Environment Variables")!;
  assert.match(envSection, /DATABASE_URL/);
  assert.match(envSection, /OPENAI_API_KEY/);
  assert.ok(!g.content.includes("supersecret"), "actual secret value must never appear in the guide");
  assert.ok(!g.content.includes("sk-fake"), "actual secret value must never appear in the guide");
});

test("Environment variable requirement detected from README wording", () => {
  const files = { ".env.example": "API_KEY=\nDEBUG=\n" };
  const g = guide(files, "API_KEY is required to run the app. DEBUG is optional.");
  const envSection = section(g.content, "6\\. Environment Variables")!;
  assert.match(envSection, /`API_KEY` — Requirement: REQUIRED/);
  assert.match(envSection, /`DEBUG` — Requirement: OPTIONAL/);
});

// 9. Repository without environment files
test("Repository without env files: Environment Variables section omitted entirely", () => {
  const files = { "package.json": JSON.stringify({ scripts: { dev: "node index.js" } }) };
  const g = guide(files);
  assert.equal(section(g.content, "6\\. Environment Variables"), null);
});

// 10. npm vs pnpm vs yarn detection
test("Package manager priority: pnpm > yarn > npm > bun by lockfile", () => {
  const base = { "package.json": JSON.stringify({ scripts: { dev: "next dev" } }) };
  const pnpm = guide({ ...base, "pnpm-lock.yaml": "" });
  const yarn = guide({ ...base, "yarn.lock": "" });
  const npm = guide({ ...base, "package-lock.json": "{}" });
  const bun = guide({ ...base, "bun.lock": "" });
  assert.match(section(pnpm.content, "5\\. Dependencies")!, /pnpm install/);
  assert.match(section(yarn.content, "5\\. Dependencies")!, /yarn install/);
  assert.match(section(npm.content, "5\\. Dependencies")!, /npm install/);
  assert.match(section(bun.content, "5\\. Dependencies")!, /bun install/);
});

test("Package manager: both pnpm and npm lockfiles present, pnpm wins per priority order", () => {
  const g = guide({
    "package.json": JSON.stringify({ scripts: { dev: "next dev" } }),
    "pnpm-lock.yaml": "",
    "package-lock.json": "{}",
  });
  assert.match(section(g.content, "5\\. Dependencies")!, /pnpm install/);
});

// 11. package scripts detection
test("Only actually-present scripts are reported — no invented dev/test/lint", () => {
  const files = {
    "package.json": JSON.stringify({ scripts: { build: "tsc" } }),
    "package-lock.json": "{}",
  };
  const g = guide(files);
  assert.equal(section(g.content, "8\\. Run the Project"), "Run command: Not identified from repository.");
  assert.equal(section(g.content, "10\\. Tests"), null);
  assert.match(section(g.content, "9\\. Build")!, /npm run build/);
});

// 12. explicit port detection
test("Explicit port detected from package.json script flag", () => {
  const files = {
    "package.json": JSON.stringify({ scripts: { dev: "next dev -p 4000" } }),
    "package-lock.json": "{}",
  };
  const g = guide(files);
  assert.match(section(g.content, "8\\. Run the Project")!, /Detected port\(s\): 4000/);
});

test("Explicit port detected from README mention", () => {
  const files = { "package.json": JSON.stringify({ scripts: { dev: "node server.js" } }), "package-lock.json": "{}" };
  const g = guide(files, "The app runs at http://localhost:8080 once started.");
  assert.match(section(g.content, "8\\. Run the Project")!, /Detected port\(s\): 8080/);
});

// 13. no port detected
test("No port detected: explicit not-identified text, not a guessed default", () => {
  const files = { "package.json": JSON.stringify({ scripts: { dev: "node server.js" } }), "package-lock.json": "{}" };
  const g = guide(files);
  assert.match(section(g.content, "8\\. Run the Project")!, /Port: Not identified from repository\./);
  assert.ok(!g.content.includes("3000"), "must not default to a guessed port like 3000");
});

// 14. README-only setup instructions
test("README-only: python install method inferred from README mention, no file evidence", () => {
  const g = guide({}, "This project uses FastAPI.");
  // No requirements.txt/pyproject.toml/etc present -> python not "detected" at all,
  // so no Python section should be fabricated purely from a README mention of a framework name.
  assert.equal(section(g.content, "5\\. Dependencies"), null);
});

// 15. conflicting README vs package.json evidence
test("Conflicting evidence: package.json lockfile wins over README's different package manager mention, noted in Troubleshooting", () => {
  const files = {
    "package.json": JSON.stringify({ scripts: { dev: "next dev" } }),
    "yarn.lock": "",
  };
  const g = guide(files, "Install dependencies with npm install.");
  assert.match(section(g.content, "5\\. Dependencies")!, /yarn install/);
  assert.ok(!section(g.content, "5\\. Dependencies")!.includes("npm install"));
  assert.match(section(g.content, "12\\. Troubleshooting / Notes")!, /yarn lockfile was found/);
});

// 16. repository with native SETUP.md (supplementary doc text is used, native file untouched)
test("Native SETUP.md content is used as supplementary evidence without being modified", () => {
  const files = { "package.json": JSON.stringify({ scripts: { dev: "next dev" } }), "package-lock.json": "{}" };
  const setupDocContent = "Run on http://localhost:5050 after starting.";
  const g = buildSetupGuide({
    repository: repo(),
    technologies: [],
    files,
    readmeContent: "",
    supplementaryDocText: setupDocContent,
  });
  assert.match(section(g.content, "8\\. Run the Project")!, /Detected port\(s\): 5050/);
  // the generated guide is a distinct document — it never claims to BE the native SETUP.md
  assert.equal(g.filePath, "[generated]/SETUP_GUIDE.md");
  assert.equal(g.source, "generated");
});

// 18. sensitive files never fetched
test("Sensitive files are never candidates for setup evidence or tech detection", () => {
  const forbidden = [".env", ".env.local", ".env.production", "credentials.json", "secrets.json", "id_rsa.key", "server.pem"];
  for (const path of forbidden) {
    assert.equal(isSetupEvidenceCandidate(path), false, `${path} must not be a setup evidence candidate`);
    assert.equal(isTechDetectionCandidate(path), false, `${path} must not be a tech detection candidate`);
  }
  const allowed = [".env.example", ".env.sample", ".env.template", "env.example"];
  for (const path of allowed) {
    assert.equal(isSetupEvidenceCandidate(path), true, `${path} should be an allowed template file`);
  }
});

// 19. empty/minimal repository
test("Empty repository: only Project Overview and Repository Setup sections, nothing fabricated", () => {
  const g = guide({});
  assert.match(g.content, /## 1\. Project Overview/);
  assert.match(g.content, /## 4\. Repository Setup/);
  assert.equal(section(g.content, "2\\. Detected Technology Stack"), null);
  assert.equal(section(g.content, "3\\. Prerequisites"), null);
  assert.equal(section(g.content, "5\\. Dependencies"), null);
  assert.equal(section(g.content, "6\\. Environment Variables"), null);
  assert.equal(section(g.content, "8\\. Run the Project"), null);
  assert.equal(section(g.content, "9\\. Build"), null);
  assert.equal(section(g.content, "10\\. Tests"), null);
  assert.match(section(g.content, "12\\. Troubleshooting / Notes")!, /No recognized build ecosystem/);
});

test("git clone / cd instructions use the actual repository URL and name", () => {
  const g = buildSetupGuide({
    repository: repo({ htmlUrl: "https://github.com/acme/my-repo", name: "my-repo" }),
    technologies: [],
    files: {},
    readmeContent: "",
  });
  assert.match(section(g.content, "4\\. Repository Setup")!, /git clone https:\/\/github\.com\/acme\/my-repo/);
  assert.match(section(g.content, "4\\. Repository Setup")!, /cd my-repo/);
});
