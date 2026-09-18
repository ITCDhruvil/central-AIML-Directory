import type { GitHubRepository } from "@/types/github";
import type { Technology, TechnologyCategory } from "@/types/technology";
import type { EvidencedCommand, SetupEvidence, SetupGuideData } from "@/lib/github/setup/types";
import {
  detectCargoTomlPath,
  detectDotNetFacts,
  detectEnvVariables,
  detectGoModPath,
  detectJavaFacts,
  detectNodeFacts,
  detectPackageManager,
  detectPortsFromText,
  detectPythonFacts,
} from "@/lib/github/setup/evidence";

export const GENERATED_SETUP_GUIDE_PATH = "[generated]/SETUP_GUIDE.md";

const CATEGORY_LABELS: Record<TechnologyCategory, string> = {
  LANGUAGE: "Language",
  FRAMEWORK: "Framework",
  LIBRARY: "Library",
  DATABASE: "Database",
  CLOUD: "Cloud",
  AI_ML: "AI / ML",
  TOOL: "Tool",
  RUNTIME: "Runtime",
  OTHER: "Other",
};

function commandBlock(commands: EvidencedCommand[]): string {
  return "```bash\n" + commands.map((c) => c.command).join("\n") + "\n```";
}

function pushEvidence(all: SetupEvidence[], ...items: (SetupEvidence | null | undefined)[]) {
  for (const item of items) if (item) all.push(item);
}

export function buildSetupGuide(input: {
  repository: GitHubRepository;
  technologies: Technology[];
  files: Record<string, string>;
  readmeContent: string;
  supplementaryDocText?: string;
}): SetupGuideData {
  const { repository, technologies, files } = input;
  const docText = [input.readmeContent, input.supplementaryDocText ?? ""].join("\n");

  const evidenceLog: SetupEvidence[] = [];
  const sections: string[] = [];

  // -- gather facts -----------------------------------------------------
  const pm = detectPackageManager(files, docText);
  const node = detectNodeFacts(files, pm?.name ?? null);
  const python = detectPythonFacts(files, docText);
  const dotnet = detectDotNetFacts(files);
  const java = detectJavaFacts(files);
  const goModPath = detectGoModPath(files);
  const cargoTomlPath = detectCargoTomlPath(files);
  const env = detectEnvVariables(files, docText);
  const textPorts = detectPortsFromText(docText);

  const anyEcosystemDetected =
    node.hasPackageJson || python.detected || dotnet.detected || java.detected || Boolean(goModPath) || Boolean(cargoTomlPath);

  // -- 1. Project Overview ----------------------------------------------
  {
    const lines = [`**${repository.fullName}**`];
    if (repository.description) lines.push("", repository.description);
    lines.push("", `Default branch: \`${repository.defaultBranch}\``);
    sections.push(`## 1. Project Overview\n\n${lines.join("\n")}`);
  }

  // -- 2. Detected Technology Stack --------------------------------------
  if (technologies.length > 0) {
    const lines = technologies.map((t) => `- ${t.name} (${CATEGORY_LABELS[t.category]})`);
    sections.push(`## 2. Detected Technology Stack\n\n${lines.join("\n")}`);
  }

  // -- 3. Prerequisites ---------------------------------------------------
  {
    const lines: string[] = [];
    if (node.hasPackageJson) {
      lines.push(
        node.engineNode
          ? `- Node.js ${node.engineNode} (from package.json engines.node)`
          : "- Node.js (version not identified from repository)",
      );
      if (node.engineNode) pushEvidence(evidenceLog, { filePath: node.packageJsonPath!, reason: "engines.node" });
    }
    if (python.detected) {
      lines.push(
        python.pythonVersion
          ? `- Python ${python.pythonVersion.value} (from ${python.pythonVersion.evidence.filePath})`
          : "- Python (version not identified from repository)",
      );
      if (python.pythonVersion) pushEvidence(evidenceLog, python.pythonVersion.evidence);
    }
    if (dotnet.detected) {
      lines.push(
        dotnet.sdkVersion
          ? `- .NET SDK ${dotnet.sdkVersion.value} (from global.json)`
          : "- .NET SDK (version not identified from repository)",
      );
      if (dotnet.sdkVersion) pushEvidence(evidenceLog, dotnet.sdkVersion.evidence);
    }
    if (java.detected) {
      const tool = java.buildTool === "maven" ? "Maven" : java.hasGradleWrapper ? "Gradle (wrapper included)" : "Gradle";
      lines.push(
        java.javaVersion
          ? `- Java ${java.javaVersion.value} JDK (from ${java.javaVersion.evidence.filePath}) + ${tool}`
          : `- Java JDK (version not identified from repository) + ${tool}`,
      );
      if (java.javaVersion) pushEvidence(evidenceLog, java.javaVersion.evidence);
    }
    if (goModPath) {
      const goVersionMatch = files[goModPath].match(/^go\s+(\d+\.\d+)/m);
      lines.push(
        goVersionMatch ? `- Go ${goVersionMatch[1]} (from go.mod)` : "- Go (version not identified from repository)",
      );
      pushEvidence(evidenceLog, { filePath: goModPath, reason: "go.mod present" });
    }
    if (cargoTomlPath) {
      lines.push("- Rust (toolchain via rustup)");
      pushEvidence(evidenceLog, { filePath: cargoTomlPath, reason: "Cargo.toml present" });
    }
    if (lines.length > 0) sections.push(`## 3. Prerequisites\n\n${lines.join("\n")}`);
  }

  // -- 4. Repository Setup -------------------------------------------------
  {
    const clone = `git clone ${repository.htmlUrl}\ncd ${repository.name}`;
    sections.push(`## 4. Repository Setup\n\n\`\`\`bash\n${clone}\n\`\`\``);
  }

  // -- 5. Dependencies ------------------------------------------------------
  {
    const blocks: string[] = [];
    if (node.hasPackageJson) {
      if (pm) {
        blocks.push(`Node.js (${pm.name}):\n\`\`\`bash\n${pm.installCommand}\n\`\`\``);
        pushEvidence(evidenceLog, pm.evidence);
      } else {
        blocks.push(
          "Node.js: Package manager not identified from repository. package.json is present — install dependencies with your preferred Node package manager.",
        );
      }
    }
    if (python.detected) {
      if (python.installCommand) {
        blocks.push(`Python:\n\`\`\`bash\n${python.installCommand.command}\n\`\`\``);
        pushEvidence(evidenceLog, python.installCommand.evidence);
      } else if (python.installMethodUnknown) {
        blocks.push("Python dependency installation method: Not identified from repository.");
      }
    }
    if (dotnet.detected) {
      const label = ".NET:";
      blocks.push(`${label}\n\`\`\`bash\ndotnet restore\n\`\`\``);
      pushEvidence(evidenceLog, { filePath: dotnet.evidencePath!, reason: ".NET project file present" });
    }
    if (java.detected) {
      const cmd = java.buildTool === "maven" ? "mvn install" : java.hasGradleWrapper ? "./gradlew build" : "gradle build";
      blocks.push(`Java (${java.buildTool}):\n\`\`\`bash\n${cmd}\n\`\`\``);
      pushEvidence(evidenceLog, { filePath: java.evidencePath!, reason: `${java.buildTool} build file present` });
    }
    if (goModPath) {
      blocks.push("Go:\n```bash\ngo mod download\n```");
      pushEvidence(evidenceLog, { filePath: goModPath, reason: "go.mod present" });
    }
    if (cargoTomlPath) {
      blocks.push("Rust: dependencies are fetched automatically when you build with Cargo (see Build section).");
    }
    if (blocks.length > 0) sections.push(`## 5. Dependencies\n\n${blocks.join("\n\n")}`);
  }

  // -- 6. Environment Variables ----------------------------------------------
  if (env.variables.length > 0) {
    const lines = env.variables.map((v) => {
      const req = v.requirement === "UNKNOWN" ? "Not identified" : v.requirement;
      return `- \`${v.name}\` — Requirement: ${req}`;
    });
    for (const path of env.evidencePaths) pushEvidence(evidenceLog, { filePath: path, reason: "environment variable names detected" });
    sections.push(
      `## 6. Environment Variables\n\n${lines.join("\n")}\n\nOnly variable names are listed — actual values are never imported. Copy the example file to \`.env\` and fill in real values yourself.`,
    );
  }

  // -- 7. Configuration -------------------------------------------------------
  if (node.configFiles.length > 0) {
    const lines = node.configFiles.map((f) => `- \`${f}\``);
    for (const f of node.configFiles) pushEvidence(evidenceLog, { filePath: f, reason: "configuration file present" });
    sections.push(`## 7. Configuration\n\nConfiguration files detected:\n\n${lines.join("\n")}`);
  }

  // -- 8. Run the Project -------------------------------------------------------
  {
    const runCommands: EvidencedCommand[] = [...node.runCommands, ...python.runCommands];
    if (dotnet.detected) {
      runCommands.push({ command: "dotnet run", evidence: { filePath: dotnet.evidencePath!, reason: ".NET project file present" } });
    }
    if (java.isSpringBoot) {
      runCommands.push({
        command: java.buildTool === "maven" ? "mvn spring-boot:run" : java.hasGradleWrapper ? "./gradlew bootRun" : "gradle bootRun",
        evidence: { filePath: java.evidencePath!, reason: "spring-boot dependency detected" },
      });
    }
    if (goModPath) {
      runCommands.push({ command: "go run .", evidence: { filePath: goModPath, reason: "go.mod present" } });
    }
    if (cargoTomlPath) {
      runCommands.push({ command: "cargo run", evidence: { filePath: cargoTomlPath, reason: "Cargo.toml present" } });
    }

    const ports = [...node.scriptPorts, ...textPorts];
    const uniquePorts = [...new Map(ports.map((p) => [p.port, p])).values()];

    if (runCommands.length > 0) {
      for (const c of runCommands) pushEvidence(evidenceLog, c.evidence);
      let body = commandBlock(runCommands);
      if (uniquePorts.length > 0) {
        for (const p of uniquePorts) pushEvidence(evidenceLog, p.evidence);
        body += `\n\nDetected port(s): ${uniquePorts.map((p) => p.port).join(", ")}`;
      } else {
        body += "\n\nPort: Not identified from repository.";
      }
      sections.push(`## 8. Run the Project\n\n${body}`);
    } else if (anyEcosystemDetected) {
      sections.push("## 8. Run the Project\n\nRun command: Not identified from repository.");
    }
  }

  // -- 9. Build -------------------------------------------------------------
  {
    const buildCommands: EvidencedCommand[] = [...node.buildCommands];
    if (dotnet.detected) {
      buildCommands.push({ command: "dotnet build", evidence: { filePath: dotnet.evidencePath!, reason: ".NET project file present" } });
    }
    if (java.detected) {
      buildCommands.push({
        command: java.buildTool === "maven" ? "mvn package" : java.hasGradleWrapper ? "./gradlew build" : "gradle build",
        evidence: { filePath: java.evidencePath!, reason: `${java.buildTool} build file present` },
      });
    }
    if (goModPath) buildCommands.push({ command: "go build ./...", evidence: { filePath: goModPath, reason: "go.mod present" } });
    if (cargoTomlPath) buildCommands.push({ command: "cargo build", evidence: { filePath: cargoTomlPath, reason: "Cargo.toml present" } });

    if (buildCommands.length > 0) {
      for (const c of buildCommands) pushEvidence(evidenceLog, c.evidence);
      sections.push(`## 9. Build\n\n${commandBlock(buildCommands)}`);
    }
  }

  // -- 10. Tests -------------------------------------------------------------
  let testCommandsForVerification: EvidencedCommand[] = [];
  {
    const testCommands: EvidencedCommand[] = [...node.testCommands, ...python.testCommands];
    if (dotnet.detected) {
      testCommands.push({ command: "dotnet test", evidence: { filePath: dotnet.evidencePath!, reason: ".NET project file present" } });
    }
    if (java.detected) {
      testCommands.push({
        command: java.buildTool === "maven" ? "mvn test" : java.hasGradleWrapper ? "./gradlew test" : "gradle test",
        evidence: { filePath: java.evidencePath!, reason: `${java.buildTool} build file present` },
      });
    }
    if (goModPath) testCommands.push({ command: "go test ./...", evidence: { filePath: goModPath, reason: "go.mod present" } });
    if (cargoTomlPath) testCommands.push({ command: "cargo test", evidence: { filePath: cargoTomlPath, reason: "Cargo.toml present" } });

    testCommandsForVerification = testCommands;
    if (testCommands.length > 0) {
      for (const c of testCommands) pushEvidence(evidenceLog, c.evidence);
      sections.push(`## 10. Tests\n\n${commandBlock(testCommands)}`);
    }
  }

  // -- 11. Verification --------------------------------------------------------
  {
    const healthMatch = docText.match(/\/(health|healthz|api\/health)\b/i);
    const anyPort = [...node.scriptPorts, ...textPorts][0];

    if (healthMatch && anyPort) {
      pushEvidence(evidenceLog, { filePath: "README.md", reason: "health endpoint mentioned in documentation" });
      sections.push(
        `## 11. Verification\n\n\`\`\`bash\ncurl http://localhost:${anyPort.port}/${healthMatch[1]}\n\`\`\``,
      );
    } else if (testCommandsForVerification.length > 0) {
      sections.push(`## 11. Verification\n\n${commandBlock(testCommandsForVerification)}`);
    } else if (node.runCommands.length > 0 || python.runCommands.length > 0 || dotnet.detected || goModPath || cargoTomlPath) {
      sections.push(
        "## 11. Verification\n\nStart the development server and verify that the application loads successfully.",
      );
    }
  }

  // -- 12. Troubleshooting / Notes ---------------------------------------------
  {
    const notes: string[] = [];
    if (env.variables.length > 0) {
      notes.push(
        "Environment variable requirement (required vs optional) could not be determined for all variables from repository evidence where marked \"Not identified\".",
      );
    }
    if (pm && readmeMentionsDifferentPackageManager(docText, pm.name)) {
      notes.push(
        `The README appears to mention a different package manager, but a ${pm.name} lockfile was found in the repository — repository configuration was preferred.`,
      );
    }
    if (env.variables.length > 0) {
      notes.push("Never commit your `.env` file or real credential values.");
    }
    if (!anyEcosystemDetected) {
      notes.push("No recognized build ecosystem (Node.js, Python, .NET, Java, Go, Rust) was detected from repository evidence.");
    }
    if (notes.length > 0) {
      sections.push(`## 12. Troubleshooting / Notes\n\n${notes.map((n) => `- ${n}`).join("\n")}`);
    }
  }

  const content = ["# Setup Guide", ...sections].join("\n\n");

  const dedupedEvidence = [...new Map(evidenceLog.map((e) => [`${e.filePath}::${e.reason}`, e])).values()];

  return {
    title: "Setup Guide",
    category: "SETUP",
    filePath: GENERATED_SETUP_GUIDE_PATH,
    content,
    source: "generated",
    evidence: dedupedEvidence,
  };
}

function readmeMentionsDifferentPackageManager(docText: string, currentPm: string): boolean {
  const otherPmMentions: Record<string, RegExp> = {
    npm: /\bnpm install\b/i,
    yarn: /\byarn install\b/i,
    pnpm: /\bpnpm install\b/i,
    bun: /\bbun install\b/i,
  };
  for (const [name, pattern] of Object.entries(otherPmMentions)) {
    if (name !== currentPm && pattern.test(docText)) return true;
  }
  return false;
}
