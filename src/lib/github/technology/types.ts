import type { Technology } from "@/types/technology";

/** Candidate files already fetched from the repository, keyed by path. */
export interface DetectionInput {
  files: Record<string, string>;
  readmeContent: string;
}

/** A rule inspects fetched files and returns zero or more HIGH-confidence candidates. */
export type FileDetectionRule = (files: Record<string, string>) => Technology[];
