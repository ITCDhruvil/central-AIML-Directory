import type { Project } from "@/types/project";

export type AttentionSeverity = "warning" | "error";

export interface AttentionIssue {
  id: string;
  severity: AttentionSeverity;
  message: string;
  /** Existing in-app path when an action is available. */
  href?: string;
  actionLabel?: string;
}

/**
 * Rule-based Overview checks from stored project fields only.
 * No live GitHub/deployment probes and no health scores.
 */
export function getNeedsAttentionIssues(project: Project): AttentionIssue[] {
  const editHref = `/projects/${project.id}/edit`;
  const issues: AttentionIssue[] = [];

  if (!project.description?.trim()) {
    issues.push({
      id: "missing-description",
      severity: "warning",
      message: "Project description is missing",
      href: editHref,
      actionLabel: "Edit",
    });
  }

  if (project.deploymentUrls.length === 0) {
    issues.push({
      id: "missing-deployment",
      severity: "warning",
      message: "Deployment URL is missing",
      href: editHref,
      actionLabel: "Edit",
    });
  }

  // Same connection rule as Overview / sync: need owner + repo (and URL when shown as connected).
  if (!project.githubOwner || !project.githubRepo) {
    issues.push({
      id: "github-not-connected",
      severity: "warning",
      message: "GitHub repository is not connected",
      href: editHref,
      actionLabel: "Edit",
    });
  }

  return issues;
}
