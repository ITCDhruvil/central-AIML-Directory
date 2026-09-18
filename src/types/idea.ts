import type { Technology } from "@/types/technology";

export const IDEA_STATUSES = ["ACTIVE", "ON_HOLD", "PROMOTED", "ARCHIVED"] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];

export interface Idea {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: IdeaStatus;
  owner: string | null;
  technologies: Technology[];
  tags: string[];
  /** Set once this idea has been promoted into a real project. */
  promotedProjectId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IdeaInput {
  name: string;
  description?: string | null;
  status: IdeaStatus;
  owner?: string | null;
  technologies?: Technology[];
  tags?: string[];
}
