import type { Documentation } from "@/types/documentation";
import type { Project } from "@/types/project";
import type { GitHubImportResult } from "@/types/github";
import { GENERATED_SETUP_GUIDE_PATH } from "@/lib/github/setup/builder";
import {
  compareDocuments,
  compareReadme,
  compareRepository,
  compareSetupGuide,
  compareTechnologies,
} from "@/lib/github/sync/compare";
import type { SyncPreview } from "@/lib/github/sync/types";

/** Assembles the full sync preview by diffing stored project state against a fresh GitHub import result. Pure — no DB/network calls. */
export function buildSyncPreview(project: Project, storedDocs: Documentation[], incoming: GitHubImportResult): SyncPreview {
  const repository = compareRepository(project, incoming.repository);
  const readme = compareReadme(storedDocs, incoming.readme);
  const documents = compareDocuments(storedDocs, incoming.documents);
  const technologies = compareTechnologies(project.technologies, incoming.technologies);

  const storedGeneratedGuide =
    storedDocs.find((d) => d.source === "generated" && d.filePath === GENERATED_SETUP_GUIDE_PATH) ?? null;
  const setupGuide = compareSetupGuide(storedGeneratedGuide, incoming.setupGuide);

  const warnings: string[] = [];
  if (setupGuide.userModified) {
    warnings.push("Your generated setup guide has been manually modified. Sync will not overwrite it.");
  }

  return {
    projectId: project.id,
    projectUpdatedAt: project.updatedAt,
    repository,
    readme,
    documents,
    technologies,
    setupGuide,
    warnings,
  };
}
