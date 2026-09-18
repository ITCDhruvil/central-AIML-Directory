export interface SetupEvidence {
  filePath: string;
  reason: string;
}

export type EnvRequirement = "REQUIRED" | "OPTIONAL" | "UNKNOWN";

export interface EnvVariableInfo {
  name: string;
  requirement: EnvRequirement;
}

export interface SetupGuideData {
  title: string;
  category: "SETUP";
  filePath: string;
  content: string;
  source: "generated";
  evidence: SetupEvidence[];
}

/** A single command with the evidence that justified it. */
export interface EvidencedCommand {
  command: string;
  evidence: SetupEvidence;
}

/** Intermediate facts the builder assembles into guide sections. */
export interface SetupFacts {
  packageManager: { name: string; evidence: SetupEvidence } | null;
  installCommands: EvidencedCommand[];
  runCommands: EvidencedCommand[];
  buildCommands: EvidencedCommand[];
  testCommands: EvidencedCommand[];
  prerequisites: { label: string; evidence: SetupEvidence }[];
  configFiles: { filePath: string; note: string }[];
  envVariables: EnvVariableInfo[];
  envEvidence: SetupEvidence[];
  ports: { port: string; evidence: SetupEvidence }[];
  verification: EvidencedCommand | { note: string } | null;
  notes: string[];
}
