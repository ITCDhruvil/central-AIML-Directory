import "server-only";
import { callAssistantModel } from "@/lib/ai/client";
import { getAIConfig } from "@/lib/ai/config";
import { autofillProjectImport } from "@/lib/ai/importAutofill";
import type { ToolDefinition } from "@/lib/ai/chatTypes";
import { GitHubApiError, fetchRepositoryReadme } from "@/lib/github/client";
import { parseGitHubRepoUrl } from "@/lib/github/parseUrl";
import {
  ProjectNotFoundError,
  createProject,
  deleteProjectById,
  getProjectById,
  listProjects,
  updateProjectFields,
} from "@/lib/projects";
import { ValidationError } from "@/lib/validation";
import { PROJECT_STAGES, PROJECT_STATUSES, PROJECT_TYPES, type Project } from "@/types/project";

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function compactProject(project: Project) {
  return {
    id: project.id,
    name: project.name,
    type: project.type,
    status: project.status,
    stage: project.stage,
    owner: project.owner,
    tags: project.tags,
    githubUrl: project.githubUrl,
  };
}

function fullProject(project: Project) {
  return {
    ...compactProject(project),
    description: project.description,
    technologies: project.technologies.map((t) => t.name),
    deploymentUrls: project.deploymentUrls,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

async function resolveProject(args: Record<string, unknown>): Promise<Project | null> {
  const id = str(args.id);
  if (id) return getProjectById(id);

  const name = str(args.name);
  if (!name) return null;
  const matches = await listProjects({ q: name });
  return matches.find((p) => p.name.toLowerCase() === name.toLowerCase()) ?? matches[0] ?? null;
}

const PROJECT_FIELD_PROPERTIES = {
  description: { type: "string", description: "Markdown description" },
  type: { type: "string", enum: [...PROJECT_TYPES] },
  status: { type: "string", enum: [...PROJECT_STATUSES] },
  stage: { type: "string", enum: [...PROJECT_STAGES] },
  owner: { type: "string" },
  githubUrl: { type: "string" },
  tags: { type: "array", items: { type: "string" } },
  technologies: { type: "array", items: { type: "string" }, description: "Technology names, e.g. [\"React\", \"Python\"]" },
  deploymentUrls: { type: "array", items: { type: "string" } },
} as const;

export const CHATBOT_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "list_projects",
      description: "List or search the user's projects, optionally filtered by free-text query, type, or status. Use this to answer 'what projects do I have', to find a project's id, or to check for name collisions before creating one.",
      parameters: {
        type: "object",
        properties: {
          q: { type: "string", description: "Free-text search over name and description" },
          type: { type: "string", enum: [...PROJECT_TYPES] },
          status: { type: "string", enum: [...PROJECT_STATUSES] },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_project",
      description: "Get full details (description, technologies, deployment URLs, timestamps) for one project by id or by name.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_project_from_github",
      description: "Given a GitHub repository URL, fetches the repo and drafts a project name, description, and technology list from its README and file structure. Does NOT save anything — show the draft to the user and get their OK before calling create_project. Call this the moment the user gives you a GitHub URL while creating a project.",
      parameters: {
        type: "object",
        properties: { repoUrl: { type: "string", description: "A github.com/owner/repo URL" } },
        required: ["repoUrl"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_project",
      description: "Creates and saves a new project. Only `name` is required. Prefer calling draft_project_from_github first and passing its draft values through here when the user has a GitHub repo.",
      parameters: {
        type: "object",
        properties: { name: { type: "string" }, ...PROJECT_FIELD_PROPERTIES },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_project",
      description: "Updates one or more fields on an existing project — e.g. change status, stage, owner, description, tags, or technologies. Only include fields that are actually changing.",
      parameters: {
        type: "object",
        properties: { id: { type: "string", description: "Project id from list_projects/get_project" }, name: { type: "string" }, ...PROJECT_FIELD_PROPERTIES },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_project",
      description: "Permanently deletes a project. DESTRUCTIVE. Call once with confirm omitted or false first — it will return the project's name without deleting anything. Only call again with confirm:true after the user explicitly confirms in their own words.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          confirm: { type: "boolean" },
        },
        required: ["id"],
      },
    },
  },
];

/**
 * A UI button the chatbot panel renders under its reply whenever a tool
 * can't finish something in chat — every failure path below attaches one
 * pointing at whatever page actually does the job, so a dead end in chat is
 * always one click from a real fix instead of more back-and-forth typing.
 */
function linkFallback(href: string, label: string) {
  return { type: "open_form" as const, href, label };
}

const BROWSE_PROJECTS_FALLBACK = linkFallback("/projects", "Browse projects");

/** Deep-link to the New Project form, optionally pre-filled with whatever we already know. */
function newProjectFormFallback(prefill: { name?: string; githubUrl?: string } = {}) {
  const params = new URLSearchParams();
  if (prefill.name) params.set("name", prefill.name);
  if (prefill.githubUrl) params.set("githubUrl", prefill.githubUrl);
  const qs = params.toString();
  return linkFallback(`/projects/new${qs ? `?${qs}` : ""}`, "Open New Project form");
}

function editProjectFormFallback(id: string) {
  return linkFallback(`/projects/${id}/edit`, "Open project editor");
}

/**
 * Deliberately uses only ONE GitHub API call (the README) instead of the full
 * import (repo metadata + file tree + up to 30 evidence-file fetches) — a
 * chat draft happens far more often than a real import, and unauthenticated
 * GitHub API requests are capped at 60/hour, shared across the whole app.
 * name/description/tags/technologies all come from the README via the AI
 * instead of from tree-based detection; githubUrl is built from the parsed
 * input directly. Less precise on technologies than a full import, but it's
 * a draft the user reviews before create_project ever saves anything.
 */

async function handleDraftProjectFromGithub(args: Record<string, unknown>) {
  const repoUrl = str(args.repoUrl);
  const parsed = repoUrl ? parseGitHubRepoUrl(repoUrl) : null;
  if (!parsed) {
    return {
      error: "That doesn't look like a valid GitHub repository URL (expected https://github.com/owner/repo).",
      ...(repoUrl ? { fallbackAction: newProjectFormFallback({ githubUrl: repoUrl }) } : {}),
    };
  }

  const config = getAIConfig();
  if (!config) {
    return {
      error: "AI is not configured on this server, so I can't draft from a README right now.",
      fallbackAction: newProjectFormFallback({ githubUrl: repoUrl }),
    };
  }

  try {
    const readme = await fetchRepositoryReadme(parsed.owner, parsed.repo);
    const autofill = await autofillProjectImport(
      {
        repoFullName: `${parsed.owner}/${parsed.repo}`,
        target: "all",
        existingName: null,
        existingDescription: null,
        existingTags: [],
        readme: readme.exists ? readme.content : "",
        detectedTechnologies: [],
        onlyFill: ["name", "description", "tags", "technologies"],
      },
      config,
      callAssistantModel,
    );

    return {
      draft: {
        name: autofill.target === "all" && autofill.name ? autofill.name : parsed.repo,
        description: autofill.target === "all" ? autofill.description : "",
        tags: autofill.target === "all" ? autofill.tags : [],
        technologies: autofill.target === "all" ? autofill.suggestedTechnologies : [],
        githubUrl: `https://github.com/${parsed.owner}/${parsed.repo}`,
        githubOwner: parsed.owner,
        githubRepo: parsed.repo,
      },
    };
  } catch (error) {
    if (error instanceof GitHubApiError) {
      return { error: error.message, fallbackAction: newProjectFormFallback({ githubUrl: repoUrl }) };
    }
    return {
      error: error instanceof Error ? error.message : "Failed to import the repository.",
      fallbackAction: newProjectFormFallback({ githubUrl: repoUrl }),
    };
  }
}

/** Safety net for any handler error not already caught with a more specific fallback below — always leaves the user a working link instead of a dead end. */
function withFallback(handler: (args: Record<string, unknown>) => Promise<unknown>) {
  return async (args: Record<string, unknown>) => {
    try {
      return await handler(args);
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Something went wrong.",
        fallbackAction: BROWSE_PROJECTS_FALLBACK,
      };
    }
  };
}

const RAW_CHATBOT_TOOL_HANDLERS: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
  list_projects: async (args) => {
    const projects = await listProjects({ q: str(args.q) || undefined, type: str(args.type) || undefined, status: str(args.status) || undefined });
    return { count: projects.length, projects: projects.map(compactProject) };
  },

  get_project: async (args) => {
    const project = await resolveProject(args);
    if (!project) return { error: "No matching project found.", fallbackAction: BROWSE_PROJECTS_FALLBACK };
    return { project: fullProject(project) };
  },

  draft_project_from_github: handleDraftProjectFromGithub,

  create_project: async (args) => {
    try {
      const project = await createProject(args);
      return { created: true, project: compactProject(project) };
    } catch (error) {
      if (error instanceof ValidationError) {
        return { error: "Validation failed", details: error.errors, fallbackAction: newProjectFormFallback({ name: str(args.name) }) };
      }
      throw error;
    }
  },

  update_project: async (args) => {
    const id = str(args.id);
    if (!id) return { error: "id is required — call list_projects or get_project first to find it.", fallbackAction: BROWSE_PROJECTS_FALLBACK };
    try {
      const project = await updateProjectFields(id, args);
      return { updated: true, project: compactProject(project) };
    } catch (error) {
      if (error instanceof ProjectNotFoundError) return { error: "Project not found.", fallbackAction: BROWSE_PROJECTS_FALLBACK };
      if (error instanceof ValidationError) {
        return { error: "Validation failed", details: error.errors, fallbackAction: editProjectFormFallback(id) };
      }
      throw error;
    }
  },

  delete_project: async (args) => {
    const id = str(args.id);
    if (!id) return { error: "id is required.", fallbackAction: BROWSE_PROJECTS_FALLBACK };
    const project = await getProjectById(id);
    if (!project) return { error: "Project not found.", fallbackAction: BROWSE_PROJECTS_FALLBACK };

    if (args.confirm !== true) {
      return { requiresConfirmation: true, project: { id: project.id, name: project.name } };
    }

    await deleteProjectById(id);
    return { deleted: true, id, name: project.name };
  },
};

export const CHATBOT_TOOL_HANDLERS: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = Object.fromEntries(
  Object.entries(RAW_CHATBOT_TOOL_HANDLERS).map(([name, handler]) => [name, withFallback(handler)]),
);
