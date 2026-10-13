import type { Role } from "@/lib/auth/permissions";

export const RESOURCE_LABELS: Record<string, string> = {
  projects: "Projects",
  ideas: "Ideas",
  documents: "Documents",
  insights: "Insights",
  search: "Global search",
  owners: "Owner names",
  settings: "Settings",
  users: "User management",
  ai_chatbot: "AI chatbot",
  ai_text_transform: "AI text transform (editor)",
  ai_project_assistant: "AI project assistant",
  ai_insights: "AI insights generation",
  ai_github_autofill: "AI GitHub autofill",
  ai_web_search: "AI web search",
};

export const RESOURCE_HINTS: Record<string, string> = {
  projects: "Own = only projects they own or that were shared with them",
  ideas: "Own = only ideas they own or that were shared with them",
  documents: "Follows the parent project; Own = documents of projects they own",
  insights: "Directory-wide: only All works",
  search: "Which results global search may return",
  users: "Admin pages for users, roles and permissions",
};

export const ACTION_LABELS: Record<string, string> = {
  view: "View",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
  use: "Allowed",
};

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  MEMBER: "Member",
  VIEWER: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMIN: "Full access to everything, including users and permissions. Always on.",
  MANAGER: "Sees and edits everything; no user management.",
  MEMBER: "Creates items; sees and edits their own.",
  VIEWER: "Read-only access to their own items.",
};
