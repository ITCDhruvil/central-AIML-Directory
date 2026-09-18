import type { Technology } from "@/types/technology";

export const PROJECT_TYPES = [
  "PROJECT",
  "POC",
  "EXPERIMENT",
  "TOOL",
  "OTHER",
] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];

export const PROJECT_STATUSES = [
  "ACTIVE",
  "COMPLETED",
  "ON_HOLD",
  "ARCHIVED",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STAGES = [
  "IDEA",
  "POC",
  "DEVELOPMENT",
  "TESTING",
  "PRODUCTION",
  "ARCHIVED",
] as const;

export type ProjectStage = (typeof PROJECT_STAGES)[number];

export const PROJECT_ACTIVITY_TYPES = [
  "PROJECT_CREATED",
  "PROJECT_UPDATED",
  "GITHUB_SYNCED",
  "DOCUMENTATION_UPDATED",
  "DEPLOYMENT_UPDATED",
] as const;

export type ProjectActivityType = (typeof PROJECT_ACTIVITY_TYPES)[number];

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: ProjectType;
  status: ProjectStatus;
  stage: ProjectStage | null;
  owner: string | null;
  githubUrl: string | null;
  githubOwner: string | null;
  githubRepo: string | null;
  defaultBranch: string | null;
  technologies: Technology[];
  tags: string[];
  deploymentUrls: string[];
  createdAt: string;
  updatedAt: string;
  lastSyncedAt: string | null;
}

export interface ProjectInput {
  name: string;
  description?: string | null;
  type: ProjectType;
  status: ProjectStatus;
  stage?: ProjectStage | null;
  owner?: string | null;
  githubUrl?: string | null;
  githubOwner?: string | null;
  githubRepo?: string | null;
  defaultBranch?: string | null;
  technologies?: Technology[];
  tags?: string[];
  deploymentUrls?: string[];
}

export interface ProjectActivity {
  id: string;
  projectId: string;
  type: ProjectActivityType;
  title: string;
  createdAt: string;
}
