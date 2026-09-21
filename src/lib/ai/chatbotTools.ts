import "server-only";
import { callAssistantModel } from "@/lib/ai/client";
import { getAIConfig } from "@/lib/ai/config";
import { autofillProjectImport } from "@/lib/ai/importAutofill";
import type { ToolDefinition } from "@/lib/ai/chatTypes";
import { GitHubApiError, fetchRepositoryReadme } from "@/lib/github/client";
import { parseGitHubRepoUrl } from "@/lib/github/parseUrl";
import { InsightsResponseError } from "@/lib/ai/insights";
import { InsightsContextNotFoundError } from "@/lib/ai/insightsContext";
import { generateAndPersistInsights, InsightsNotConfiguredError } from "@/lib/ai/runInsights";
import {
  CATALOG_INSIGHT_SCOPE,
  getInsightById,
  getInsightSnapshot,
  InsightNotFoundError,
  insightScope,
  saveInsightAsIdea,
} from "@/lib/insightCatalog";
import {
  IdeaNotFoundError,
  createIdea,
  deleteIdeaById,
  getIdeaById,
  listIdeas,
  promoteIdeaToProject,
  updateIdeaFields,
} from "@/lib/ideas";
import { listOwners } from "@/lib/owners";
import { portfolioSnapshot } from "@/lib/portfolioSnapshot";
import { ideasSnapshot, insightsPulse } from "@/lib/workspaceSnapshot";
import {
  ProjectNotFoundError,
  createProject,
  deleteProjectById,
  getProjectById,
  listProjects,
  updateProjectFields,
} from "@/lib/projects";
import { ValidationError } from "@/lib/validation";
import { IDEA_STATUSES, type Idea } from "@/types/idea";
import type { Insight } from "@/types/insight";
import { PROJECT_STAGES, PROJECT_STATUSES, PROJECT_TYPES, type Project } from "@/types/project";
import type { ThemePreference } from "@/lib/theme";

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function compactIdea(idea: Idea) {
  return {
    id: idea.id,
    name: idea.name,
    status: idea.status,
    owner: idea.owner,
    tags: idea.tags,
    promotedProjectId: idea.promotedProjectId,
  };
}

function fullIdea(idea: Idea) {
  return {
    ...compactIdea(idea),
    description: idea.description,
    technologies: idea.technologies.map((t) => t.name),
    createdAt: idea.createdAt,
    updatedAt: idea.updatedAt,
  };
}

function compactInsight(insight: Insight) {
  return {
    id: insight.id,
    type: insight.type,
    title: insight.title,
    suggestedTool: insight.suggestedTool,
    relatedProjectName: insight.relatedProjectName,
    savedAsIdea: insight.savedAsIdea,
    lastChange: insight.lastChange,
  };
}

async function resolveIdea(args: Record<string, unknown>): Promise<Idea | null> {
  const id = str(args.id);
  if (id) return getIdeaById(id);

  const name = str(args.name);
  if (!name) return null;
  const matches = await listIdeas({ q: name });
  return matches.find((idea) => idea.name.toLowerCase() === name.toLowerCase()) ?? matches[0] ?? null;
}

async function resolveInsight(args: Record<string, unknown>): Promise<Insight | null> {
  const id = str(args.id);
  if (id) return getInsightById(id);

  const title = str(args.title);
  if (!title) return null;
  const snapshot = await getInsightSnapshot(CATALOG_INSIGHT_SCOPE);
  const needle = title.toLowerCase();
  return (
    snapshot.insights.find((insight) => insight.title.toLowerCase() === needle) ??
    snapshot.insights.find((insight) => insight.title.toLowerCase().includes(needle)) ??
    null
  );
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

const IDEA_FIELD_PROPERTIES = {
  description: { type: "string", description: "Markdown description" },
  status: { type: "string", enum: [...IDEA_STATUSES] },
  owner: { type: "string" },
  tags: { type: "array", items: { type: "string" } },
  technologies: { type: "array", items: { type: "string" }, description: "Technology names, e.g. [\"Python\", \"RAG\"]" },
} as const;

const OPEN_PAGES = {
  dashboard: { href: "/", label: "Open dashboard" },
  projects: { href: "/projects", label: "Browse projects" },
  ideas: { href: "/ideas", label: "Browse ideas" },
  insights: { href: "/insights", label: "Open insights" },
  settings: { href: "/settings", label: "Open settings" },
  new_project: { href: "/projects/new", label: "Open New Project form" },
  new_idea: { href: "/ideas/new", label: "Open New Idea form" },
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
  {
    type: "function",
    function: {
      name: "list_ideas",
      description: "List or search captured ideas, optionally filtered by free-text query or status. Use this for 'what ideas do I have', to find an idea's id, or before creating one to check for a similar name.",
      parameters: {
        type: "object",
        properties: {
          q: { type: "string", description: "Free-text search over name and description" },
          status: { type: "string", enum: [...IDEA_STATUSES] },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_idea",
      description: "Get full details for one idea by id or by name.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" }, name: { type: "string" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_idea",
      description: "Creates and saves a new idea. Only `name` is required. Status defaults to ACTIVE.",
      parameters: {
        type: "object",
        properties: { name: { type: "string" }, ...IDEA_FIELD_PROPERTIES },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_idea",
      description: "Updates one or more fields on an existing idea. Only include fields that are actually changing.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" }, name: { type: "string" }, ...IDEA_FIELD_PROPERTIES },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "promote_idea",
      description: "Turns an idea into a real project (copies name/description/tags/tech, marks the idea PROMOTED). DESTRUCTIVE to the idea's status. Call once with confirm omitted or false first. Only call again with confirm:true after the user explicitly confirms.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" }, confirm: { type: "boolean" } },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_idea",
      description: "Permanently deletes an idea. DESTRUCTIVE. Call once with confirm omitted or false first. Only call again with confirm:true after the user explicitly confirms.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" }, confirm: { type: "boolean" } },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_dashboard",
      description: "Workspace snapshot for the dashboard: project counts by status plus GitHub/deploy coverage, idea counts by status, and saved insights (new ideas vs improvements, last generated). Use this for 'how's the portfolio', 'summarize the dashboard', or overview questions.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_insights",
      description: "List saved AI insights (catalog-wide, or scoped to one project). Use this to answer 'what insights do I have' or to find an insight id before saving it as an idea.",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "string" },
          projectName: { type: "string", description: "Resolve a project by name when the user didn't give an id" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_insight",
      description: "Get one insight's full reasoning by id or title.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" }, title: { type: "string" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_insight_as_idea",
      description: "Saves an insight as a new idea (same as the Insights page 'Save as idea' button). Idempotent if it was already saved.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" }, title: { type: "string" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_insights",
      description: "Runs the Insights generator (catalog-wide, or for one project) and saves the results. Slow — it may search the web. Tell the user you're generating, then call this. Do not invent insights yourself.",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "string" },
          projectName: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_owners",
      description: "List saved owner names used on project and idea forms.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "set_appearance",
      description: "Change this browser's appearance (light, dark, or system). Settings are local to this device — the tool asks the chat UI to apply the theme.",
      parameters: {
        type: "object",
        properties: { theme: { type: "string", enum: ["light", "dark", "system"] } },
        required: ["theme"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "open_page",
      description: "Open a real app page (dashboard, projects, ideas, insights, settings, or a new-item form) via a button under your reply. Use when the user asks to go somewhere, or when they need a form you shouldn't fake in chat.",
      parameters: {
        type: "object",
        properties: { page: { type: "string", enum: Object.keys(OPEN_PAGES) } },
        required: ["page"],
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
const BROWSE_IDEAS_FALLBACK = linkFallback("/ideas", "Browse ideas");
const OPEN_INSIGHTS_FALLBACK = linkFallback("/insights", "Open insights");
const OPEN_DASHBOARD_FALLBACK = linkFallback("/", "Open dashboard");
const OPEN_SETTINGS_FALLBACK = linkFallback("/settings", "Open settings");

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

function newIdeaFormFallback(prefill: { name?: string } = {}) {
  const params = new URLSearchParams();
  if (prefill.name) params.set("name", prefill.name);
  const qs = params.toString();
  return linkFallback(`/ideas/new${qs ? `?${qs}` : ""}`, "Open New Idea form");
}

function editIdeaFormFallback(id: string) {
  return linkFallback(`/ideas/${id}/edit`, "Open idea editor");
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

function withFallback(
  handler: (args: Record<string, unknown>) => Promise<unknown>,
  fallback = OPEN_DASHBOARD_FALLBACK,
) {
  return async (args: Record<string, unknown>) => {
    try {
      return await handler(args);
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Something went wrong.",
        fallbackAction: fallback,
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

  list_ideas: async (args) => {
    const ideas = await listIdeas({
      q: str(args.q) || undefined,
      status: str(args.status) || undefined,
    });
    return { count: ideas.length, ideas: ideas.map(compactIdea), related: { href: "/ideas", name: "Ideas" } };
  },

  get_idea: async (args) => {
    const idea = await resolveIdea(args);
    if (!idea) return { error: "No matching idea found.", fallbackAction: BROWSE_IDEAS_FALLBACK };
    return { idea: fullIdea(idea) };
  },

  create_idea: async (args) => {
    try {
      const idea = await createIdea(args);
      return { created: true, idea: compactIdea(idea) };
    } catch (error) {
      if (error instanceof ValidationError) {
        return { error: "Validation failed", details: error.errors, fallbackAction: newIdeaFormFallback({ name: str(args.name) }) };
      }
      throw error;
    }
  },

  update_idea: async (args) => {
    const id = str(args.id);
    if (!id) return { error: "id is required — call list_ideas or get_idea first to find it.", fallbackAction: BROWSE_IDEAS_FALLBACK };
    try {
      const idea = await updateIdeaFields(id, args);
      return { updated: true, idea: compactIdea(idea) };
    } catch (error) {
      if (error instanceof IdeaNotFoundError) return { error: "Idea not found.", fallbackAction: BROWSE_IDEAS_FALLBACK };
      if (error instanceof ValidationError) {
        return { error: "Validation failed", details: error.errors, fallbackAction: editIdeaFormFallback(id) };
      }
      throw error;
    }
  },

  promote_idea: async (args) => {
    const id = str(args.id);
    if (!id) return { error: "id is required.", fallbackAction: BROWSE_IDEAS_FALLBACK };
    const idea = await getIdeaById(id);
    if (!idea) return { error: "Idea not found.", fallbackAction: BROWSE_IDEAS_FALLBACK };
    if (idea.status === "PROMOTED") {
      return {
        error: "This idea has already been promoted.",
        idea: compactIdea(idea),
        fallbackAction: idea.promotedProjectId
          ? linkFallback(`/projects/${idea.promotedProjectId}`, "Open the project")
          : BROWSE_IDEAS_FALLBACK,
      };
    }
    if (args.confirm !== true) {
      return { requiresConfirmation: true, action: "promote", idea: { id: idea.id, name: idea.name } };
    }
    try {
      const result = await promoteIdeaToProject(id);
      return { promoted: true, idea: compactIdea(result.idea), project: compactProject(result.project) };
    } catch (error) {
      if (error instanceof ValidationError) {
        return { error: "Validation failed", details: error.errors, fallbackAction: BROWSE_IDEAS_FALLBACK };
      }
      throw error;
    }
  },

  delete_idea: async (args) => {
    const id = str(args.id);
    if (!id) return { error: "id is required.", fallbackAction: BROWSE_IDEAS_FALLBACK };
    const idea = await getIdeaById(id);
    if (!idea) return { error: "Idea not found.", fallbackAction: BROWSE_IDEAS_FALLBACK };
    if (args.confirm !== true) {
      return { requiresConfirmation: true, action: "delete", idea: { id: idea.id, name: idea.name } };
    }
    await deleteIdeaById(id);
    return { deleted: true, id, name: idea.name };
  },

  get_dashboard: async () => {
    const [projects, ideaRows, insightSnap] = await Promise.all([
      listProjects(),
      listIdeas(),
      getInsightSnapshot(CATALOG_INSIGHT_SCOPE),
    ]);
    const snapshot = portfolioSnapshot(projects);
    const ideas = ideasSnapshot(ideaRows);
    const insights = insightsPulse(insightSnap);
    return {
      dashboard: {
        projects: snapshot,
        ideas,
        insights: { saved: insights.total, ...insights },
      },
      related: { href: "/", name: "Dashboard" },
    };
  },

  list_insights: async (args) => {
    let projectId = str(args.projectId) || undefined;
    const projectName = str(args.projectName);
    if (!projectId && projectName) {
      const project = await resolveProject({ name: projectName });
      if (!project) return { error: "No matching project found.", fallbackAction: BROWSE_PROJECTS_FALLBACK };
      projectId = project.id;
    }
    const snapshot = await getInsightSnapshot(insightScope(projectId));
    return {
      count: snapshot.insights.length,
      generation: snapshot.generation,
      insights: snapshot.insights.map(compactInsight),
      related: { href: projectId ? `/projects/${projectId}` : "/insights", name: "Insights" },
    };
  },

  get_insight: async (args) => {
    const insight = await resolveInsight(args);
    if (!insight) return { error: "No matching insight found.", fallbackAction: OPEN_INSIGHTS_FALLBACK };
    return { insight };
  },

  save_insight_as_idea: async (args) => {
    const insight = await resolveInsight(args);
    if (!insight) return { error: "No matching insight found.", fallbackAction: OPEN_INSIGHTS_FALLBACK };
    try {
      const saved = await saveInsightAsIdea(insight.id);
      return { savedAsIdea: true, insight: compactInsight(saved), related: { href: "/ideas", name: "Ideas" } };
    } catch (error) {
      if (error instanceof InsightNotFoundError) return { error: "Insight not found.", fallbackAction: OPEN_INSIGHTS_FALLBACK };
      throw error;
    }
  },

  generate_insights: async (args) => {
    let projectId = str(args.projectId) || undefined;
    const projectName = str(args.projectName);
    if (!projectId && projectName) {
      const project = await resolveProject({ name: projectName });
      if (!project) return { error: "No matching project found.", fallbackAction: BROWSE_PROJECTS_FALLBACK };
      projectId = project.id;
    }
    try {
      const snapshot = await generateAndPersistInsights(projectId);
      return {
        generated: true,
        added: snapshot.generation?.addedCount ?? 0,
        updated: snapshot.generation?.updatedCount ?? 0,
        unchanged: snapshot.generation?.unchangedCount ?? 0,
        insights: snapshot.insights.map(compactInsight),
        related: { href: projectId ? `/projects/${projectId}` : "/insights", name: "Insights" },
      };
    } catch (error) {
      if (error instanceof InsightsNotConfiguredError) {
        return { error: "AI is not configured, so I can't generate insights right now.", fallbackAction: OPEN_INSIGHTS_FALLBACK };
      }
      if (error instanceof InsightsContextNotFoundError) {
        return { error: "Project not found.", fallbackAction: BROWSE_PROJECTS_FALLBACK };
      }
      if (error instanceof InsightsResponseError || error instanceof Error) {
        return { error: "Couldn't generate insights right now.", fallbackAction: OPEN_INSIGHTS_FALLBACK };
      }
      throw error;
    }
  },

  list_owners: async () => {
    const owners = await listOwners();
    return { count: owners.length, owners };
  },

  set_appearance: async (args) => {
    const theme = str(args.theme) as ThemePreference;
    if (theme !== "light" && theme !== "dark" && theme !== "system") {
      return { error: "theme must be light, dark, or system.", fallbackAction: OPEN_SETTINGS_FALLBACK };
    }
    return {
      applied: true,
      theme,
      clientAction: { type: "set_theme", theme },
    };
  },

  open_page: async (args) => {
    const page = str(args.page) as keyof typeof OPEN_PAGES;
    const target = OPEN_PAGES[page];
    if (!target) {
      return { error: `Unknown page. Use one of: ${Object.keys(OPEN_PAGES).join(", ")}.` };
    }
    return { opened: true, navAction: target };
  },
};

export const CHATBOT_TOOL_HANDLERS: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = Object.fromEntries(
  Object.entries(RAW_CHATBOT_TOOL_HANDLERS).map(([name, handler]) => [name, withFallback(handler)]),
);
