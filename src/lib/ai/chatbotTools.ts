import { isSelf } from "@/lib/ai/selfMatch";
import "server-only";
import { callAssistantModel } from "@/lib/ai/client";
import { getAIConfig } from "@/lib/ai/config";
import { autofillProjectImport } from "@/lib/ai/importAutofill";
import { GitHubApiError, fetchRepositoryReadme } from "@/lib/github/client";
import { parseGitHubRepoUrl } from "@/lib/github/parseUrl";
import { InsightsResponseError } from "@/lib/ai/insights";
import { InsightsContextNotFoundError } from "@/lib/ai/insightsContext";
import {
  generateAndPersistInsights,
  InsightsNotConfiguredError,
} from "@/lib/ai/runInsights";
import {
  CATALOG_INSIGHT_SCOPE,
  getInsightById,
  getInsightSnapshot,
  InsightNotFoundError,
  insightScope,
  listInsights,
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
import { ownerNameMatches } from "@/lib/ownerSearch";
import { portfolioSnapshot } from "@/lib/portfolioSnapshot";
import { ideasSnapshot, insightsPulse } from "@/lib/workspaceSnapshot";
import {
  getDocumentationRecord,
  listDocumentation,
  searchDocumentation,
  type DocumentationWithProject,
} from "@/lib/documents";
import {
  listRecentProjectActivities,
  searchProjectActivities,
} from "@/lib/projectActivity";
import { buildSnippet, tokenize } from "@/lib/search/matcher";
import { CHATBOT_TOOLS, OPEN_PAGES } from "@/lib/ai/chatbotToolDefs";
import {
  describeRequirement,
  toolAvailable,
  toolsFor,
} from "@/lib/ai/chatbotAccess";
import { buildAdminHandlers } from "@/lib/ai/chatbotAdminHandlers";
import { buildTeamHandlers } from "@/lib/ai/chatbotTeamHandlers";
import { memberRoleLabel } from "@/lib/auth/membership";
import { addCreatorAsOwner } from "@/lib/projectTeam";
import type { ChatbotContext } from "@/lib/ai/chatbotContext";
import { withOwnerDefault } from "@/lib/auth/ownerDefault";
import { can, scopeFor } from "@/lib/auth/permissions";
import type { AccessScope } from "@/lib/auth/scope";
import {
  ProjectNotFoundError,
  createProject,
  deleteProjectById,
  getProjectById,
  listProjects,
  updateProjectFields,
} from "@/lib/projects";
import { ValidationError } from "@/lib/validation";
import type { Idea } from "@/types/idea";
import type { Insight } from "@/types/insight";
import type { Project } from "@/types/project";
import type { ThemePreference } from "@/lib/theme";

export { CHATBOT_TOOLS };

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function compactIdea(idea: Idea) {
  return {
    id: idea.id,
    name: idea.name,
    slug: idea.slug,
    status: idea.status,
    owner: idea.owner,
    tags: idea.tags,
    technologies: idea.technologies.map((t) => t.name),
    promotedProjectId: idea.promotedProjectId,
  };
}

function fullIdea(idea: Idea) {
  return {
    ...compactIdea(idea),
    description: idea.description,
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

async function resolveIdea(
  args: Record<string, unknown>,
  access: AccessScope,
): Promise<Idea | null> {
  const id = str(args.id);
  if (id) return getIdeaById(id, access);

  const name = str(args.name);
  if (!name) return null;
  const matches = await listIdeas({ q: name }, access);
  return (
    matches.find((idea) => idea.name.toLowerCase() === name.toLowerCase()) ??
    matches[0] ??
    null
  );
}

async function resolveInsight(
  args: Record<string, unknown>,
): Promise<Insight | null> {
  const id = str(args.id);
  if (id) return getInsightById(id);

  const title = str(args.title);
  if (!title) return null;
  const matches = await listInsights({ q: title });
  const needle = title.toLowerCase();
  return (
    matches.find((insight) => insight.title.toLowerCase() === needle) ??
    matches.find((insight) => insight.title.toLowerCase().includes(needle)) ??
    null
  );
}

function compactProject(project: Project) {
  return {
    id: project.id,
    name: project.name,
    slug: project.slug,
    type: project.type,
    status: project.status,
    stage: project.stage,
    owner: project.owner,
    tags: project.tags,
    technologies: project.technologies.map((t) => t.name),
    githubUrl: project.githubUrl,
    githubRepo: project.githubRepo,
    deploymentUrls: project.deploymentUrls,
  };
}

function fullProject(
  project: Project,
  extras: {
    documents: {
      id: string;
      title: string;
      category: string;
      filePath: string;
      source: string;
    }[];
    recentActivity: { type: string; title: string; createdAt: string }[];
  },
) {
  return {
    ...compactProject(project),
    description: project.description,
    githubOwner: project.githubOwner,
    defaultBranch: project.defaultBranch,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    lastSyncedAt: project.lastSyncedAt,
    team: (project.team ?? []).map((m) => ({
      name: m.name,
      role: memberRoleLabel(m.role),
    })),
    documents: extras.documents,
    recentActivity: extras.recentActivity,
  };
}

function documentSnippet(content: string, q: string): string | null {
  const tokens = tokenize(q);
  if (tokens.length === 0) return null;
  return buildSnippet(content, tokens)
    .map((segment) => segment.text)
    .join("");
}

function compactDocument(doc: DocumentationWithProject, q?: string) {
  return {
    id: doc.id,
    projectId: doc.projectId,
    projectName: doc.projectName,
    title: doc.title,
    category: doc.category,
    filePath: doc.filePath,
    source: doc.source,
    href: `/projects/${doc.projectId}/documents/${doc.id}`,
    snippet: q ? documentSnippet(doc.content, q) : null,
  };
}

const DOCUMENT_CONTENT_MAX = 12_000;

function fullDocument(doc: DocumentationWithProject) {
  const truncated = doc.content.length > DOCUMENT_CONTENT_MAX;
  return {
    id: doc.id,
    projectId: doc.projectId,
    projectName: doc.projectName,
    title: doc.title,
    category: doc.category,
    filePath: doc.filePath,
    source: doc.source,
    href: `/projects/${doc.projectId}/documents/${doc.id}`,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    truncated,
    content: truncated
      ? doc.content.slice(0, DOCUMENT_CONTENT_MAX)
      : doc.content,
  };
}

async function resolveProject(
  args: Record<string, unknown>,
  access: AccessScope,
): Promise<Project | null> {
  const id = str(args.id);
  if (id) return getProjectById(id, access);

  const name = str(args.name);
  if (!name) return null;
  const matches = await listProjects({ q: name }, access);
  return (
    matches.find((p) => p.name.toLowerCase() === name.toLowerCase()) ??
    matches[0] ??
    null
  );
}

async function resolveDocument(
  args: Record<string, unknown>,
  access: AccessScope,
): Promise<DocumentationWithProject | null> {
  const id = str(args.id);
  if (id) return getDocumentationRecord(id, access);

  const title = str(args.title);
  if (!title) return null;
  const projectId = str(args.projectId) || undefined;
  const matches = await searchDocumentation({ q: title, projectId }, access);
  const needle = title.toLowerCase();
  return (
    matches.find((doc) => doc.title.toLowerCase() === needle) ??
    matches.find((doc) => doc.title.toLowerCase().includes(needle)) ??
    matches[0] ??
    null
  );
}

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
function newProjectFormFallback(
  prefill: { name?: string; githubUrl?: string } = {},
) {
  const params = new URLSearchParams();
  if (prefill.name) params.set("name", prefill.name);
  if (prefill.githubUrl) params.set("githubUrl", prefill.githubUrl);
  const qs = params.toString();
  return linkFallback(
    `/projects/new${qs ? `?${qs}` : ""}`,
    "Open New Project form",
  );
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
      error:
        "That doesn't look like a valid GitHub repository URL (expected https://github.com/owner/repo).",
      ...(repoUrl
        ? { fallbackAction: newProjectFormFallback({ githubUrl: repoUrl }) }
        : {}),
    };
  }

  const config = getAIConfig();
  if (!config) {
    return {
      error:
        "AI is not configured on this server, so I can't draft from a README right now.",
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
        name:
          autofill.target === "all" && autofill.name
            ? autofill.name
            : parsed.repo,
        description: autofill.target === "all" ? autofill.description : "",
        tags: autofill.target === "all" ? autofill.tags : [],
        technologies:
          autofill.target === "all" ? autofill.suggestedTechnologies : [],
        githubUrl: `https://github.com/${parsed.owner}/${parsed.repo}`,
        githubOwner: parsed.owner,
        githubRepo: parsed.repo,
      },
    };
  } catch (error) {
    if (error instanceof GitHubApiError) {
      return {
        error: error.message,
        fallbackAction: newProjectFormFallback({ githubUrl: repoUrl }),
      };
    }
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to import the repository.",
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

type ToolHandlerMap = Record<
  string,
  (args: Record<string, unknown>) => Promise<unknown>
>;

/** Handlers bound to one signed-in user: every read and write goes through that user's access scopes. */
function buildRawHandlers(ctx: ChatbotContext): ToolHandlerMap {
  const { user, view, edit, remove } = ctx;
  const adminHandlers = buildAdminHandlers(ctx);
  const teamHandlers = buildTeamHandlers(ctx);
  const allowed = (resource: string, action: string) =>
    can(user.permissions, resource, action);
  const insightsAll = scopeFor(user.permissions, "insights", "view") === "ALL";

  return {
    search_workspace: async (args) => {
      const q = str(args.q);
      if (!q) return { error: "q is required." };
      const [projects, ideas, documents, insights, owners, activities] =
        await Promise.all([
          allowed("projects", "view") ? listProjects({ q }, view.projects) : [],
          allowed("ideas", "view") ? listIdeas({ q }, view.ideas) : [],
          allowed("documents", "view")
            ? searchDocumentation({ q }, view.documents)
            : [],
          insightsAll ? listInsights({ q }) : [],
          allowed("owners", "view") ? listOwners() : [],
          allowed("projects", "view")
            ? searchProjectActivities({ q }, 30, view.projects)
            : [],
        ]);
      const matchedOwners = owners.filter((owner) =>
        ownerNameMatches(owner.name, q),
      );
      return {
        query: q,
        projects: {
          count: projects.length,
          items: projects.slice(0, 20).map(compactProject),
        },
        ideas: {
          count: ideas.length,
          items: ideas.slice(0, 20).map(compactIdea),
        },
        documents: {
          count: documents.length,
          items: documents.slice(0, 20).map((doc) => compactDocument(doc, q)),
        },
        insights: {
          count: insights.length,
          items: insights.slice(0, 20).map(compactInsight),
        },
        owners: {
          count: matchedOwners.length,
          items: matchedOwners.slice(0, 20),
        },
        activities: {
          count: activities.length,
          items: activities.slice(0, 20),
        },
      };
    },

    list_projects: async (args) => {
      const owner = str(args.owner) || undefined;
      const filters = {
        q: str(args.q) || undefined,
        type: str(args.type) || undefined,
        status: str(args.status) || undefined,
        stage: str(args.stage) || undefined,
        tag: str(args.tag) || undefined,
        technology: str(args.technology) || undefined,
      };
      let projects = await listProjects({ ...filters, owner }, view.projects);
      let note: string | undefined;
      let hint: string | undefined;
      if (owner && projects.length === 0) {
        // "my projects" often arrives as the person's own name. If nothing is owned under it, show what they can see.
        const visible = await listProjects(filters, view.projects);
        if (visible.length > 0) {
          if (isSelf(owner, user)) {
            projects = visible;
            note =
              "No projects list you as the owner by name, so this is every project you can see.";
          } else {
            hint = `No project has an owner matching "${owner}", but ${visible.length} match the other filters. Check list_owners for the saved name.`;
          }
        }
      }
      return {
        count: projects.length,
        projects: projects.map(compactProject),
        ...(note ? { note } : {}),
        ...(hint ? { hint } : {}),
      };
    },

    get_project: async (args) => {
      const project = await resolveProject(args, view.projects);
      if (!project)
        return {
          error: "No matching project found.",
          fallbackAction: BROWSE_PROJECTS_FALLBACK,
        };
      const [documents, recentActivity] = await Promise.all([
        allowed("documents", "view")
          ? listDocumentation(project.id, view.documents)
          : [],
        listRecentProjectActivities(project.id, 20),
      ]);
      return {
        project: fullProject(project, {
          documents: documents.map((doc) => ({
            id: doc.id,
            title: doc.title,
            category: doc.category,
            filePath: doc.filePath,
            source: doc.source,
          })),
          recentActivity: recentActivity.map((row) => ({
            type: row.type,
            title: row.title,
            createdAt: row.createdAt,
          })),
        }),
      };
    },

    draft_project_from_github: handleDraftProjectFromGithub,

    create_project: async (args) => {
      try {
        const project = await createProject(
          withOwnerDefault(args, user, "projects"),
        );
        await addCreatorAsOwner("PROJECT", project.id, user.id);
        return { created: true, project: compactProject(project) };
      } catch (error) {
        if (error instanceof ValidationError) {
          return {
            error: "Validation failed",
            details: error.errors,
            fallbackAction: newProjectFormFallback({ name: str(args.name) }),
          };
        }
        throw error;
      }
    },

    update_project: async (args) => {
      const id = str(args.id);
      if (!id)
        return {
          error:
            "id is required — call list_projects or get_project first to find it.",
          fallbackAction: BROWSE_PROJECTS_FALLBACK,
        };
      try {
        const project = await updateProjectFields(id, args, edit.projects);
        return { updated: true, project: compactProject(project) };
      } catch (error) {
        if (error instanceof ProjectNotFoundError)
          return {
            error: "Project not found.",
            fallbackAction: BROWSE_PROJECTS_FALLBACK,
          };
        if (error instanceof ValidationError) {
          return {
            error: "Validation failed",
            details: error.errors,
            fallbackAction: editProjectFormFallback(id),
          };
        }
        throw error;
      }
    },

    delete_project: async (args) => {
      const id = str(args.id);
      if (!id)
        return {
          error: "id is required.",
          fallbackAction: BROWSE_PROJECTS_FALLBACK,
        };
      const project = await getProjectById(id, remove.projects);
      if (!project)
        return {
          error: "Project not found.",
          fallbackAction: BROWSE_PROJECTS_FALLBACK,
        };

      if (args.confirm !== true) {
        return {
          requiresConfirmation: true,
          project: { id: project.id, name: project.name },
        };
      }

      await deleteProjectById(id, remove.projects);
      return { deleted: true, id, name: project.name };
    },

    list_ideas: async (args) => {
      const owner = str(args.owner) || undefined;
      const filters = {
        q: str(args.q) || undefined,
        status: str(args.status) || undefined,
        tag: str(args.tag) || undefined,
        technology: str(args.technology) || undefined,
      };
      let ideas = await listIdeas({ ...filters, owner }, view.ideas);
      let note: string | undefined;
      let hint: string | undefined;
      if (owner && ideas.length === 0) {
        const visible = await listIdeas(filters, view.ideas);
        if (visible.length > 0) {
          if (isSelf(owner, user)) {
            ideas = visible;
            note =
              "No ideas list you as the owner by name, so this is every idea you can see.";
          } else {
            hint = `No idea has an owner matching "${owner}", but ${visible.length} match the other filters. Check list_owners for the saved name.`;
          }
        }
      }
      return {
        count: ideas.length,
        ideas: ideas.map(compactIdea),
        ...(note ? { note } : {}),
        ...(hint ? { hint } : {}),
        related: { href: "/ideas", name: "Ideas" },
      };
    },

    get_idea: async (args) => {
      const idea = await resolveIdea(args, view.ideas);
      if (!idea)
        return {
          error: "No matching idea found.",
          fallbackAction: BROWSE_IDEAS_FALLBACK,
        };
      return { idea: fullIdea(idea) };
    },

    create_idea: async (args) => {
      try {
        const idea = await createIdea(withOwnerDefault(args, user, "ideas"));
        return { created: true, idea: compactIdea(idea) };
      } catch (error) {
        if (error instanceof ValidationError) {
          return {
            error: "Validation failed",
            details: error.errors,
            fallbackAction: newIdeaFormFallback({ name: str(args.name) }),
          };
        }
        throw error;
      }
    },

    update_idea: async (args) => {
      const id = str(args.id);
      if (!id)
        return {
          error:
            "id is required — call list_ideas or get_idea first to find it.",
          fallbackAction: BROWSE_IDEAS_FALLBACK,
        };
      try {
        const idea = await updateIdeaFields(id, args, edit.ideas);
        return { updated: true, idea: compactIdea(idea) };
      } catch (error) {
        if (error instanceof IdeaNotFoundError)
          return {
            error: "Idea not found.",
            fallbackAction: BROWSE_IDEAS_FALLBACK,
          };
        if (error instanceof ValidationError) {
          return {
            error: "Validation failed",
            details: error.errors,
            fallbackAction: editIdeaFormFallback(id),
          };
        }
        throw error;
      }
    },

    promote_idea: async (args) => {
      const id = str(args.id);
      if (!id)
        return {
          error: "id is required.",
          fallbackAction: BROWSE_IDEAS_FALLBACK,
        };
      const idea = await getIdeaById(id, edit.ideas);
      if (!idea)
        return {
          error: "Idea not found.",
          fallbackAction: BROWSE_IDEAS_FALLBACK,
        };
      if (idea.status === "PROMOTED") {
        return {
          error: "This idea has already been promoted.",
          idea: compactIdea(idea),
          fallbackAction: idea.promotedProjectId
            ? linkFallback(
                `/projects/${idea.promotedProjectId}`,
                "Open the project",
              )
            : BROWSE_IDEAS_FALLBACK,
        };
      }
      if (args.confirm !== true) {
        return {
          requiresConfirmation: true,
          action: "promote",
          idea: { id: idea.id, name: idea.name },
        };
      }
      try {
        const result = await promoteIdeaToProject(id, edit.ideas);
        return {
          promoted: true,
          idea: compactIdea(result.idea),
          project: compactProject(result.project),
        };
      } catch (error) {
        if (error instanceof ValidationError) {
          return {
            error: "Validation failed",
            details: error.errors,
            fallbackAction: BROWSE_IDEAS_FALLBACK,
          };
        }
        throw error;
      }
    },

    delete_idea: async (args) => {
      const id = str(args.id);
      if (!id)
        return {
          error: "id is required.",
          fallbackAction: BROWSE_IDEAS_FALLBACK,
        };
      const idea = await getIdeaById(id, remove.ideas);
      if (!idea)
        return {
          error: "Idea not found.",
          fallbackAction: BROWSE_IDEAS_FALLBACK,
        };
      if (args.confirm !== true) {
        return {
          requiresConfirmation: true,
          action: "delete",
          idea: { id: idea.id, name: idea.name },
        };
      }
      await deleteIdeaById(id, remove.ideas);
      return { deleted: true, id, name: idea.name };
    },

    list_documents: async (args) => {
      let projectId = str(args.projectId) || undefined;
      const projectName = str(args.projectName);
      if (!projectId && projectName) {
        const project = await resolveProject(
          { name: projectName },
          view.projects,
        );
        if (!project)
          return {
            error: "No matching project found.",
            fallbackAction: BROWSE_PROJECTS_FALLBACK,
          };
        projectId = project.id;
      }
      const q = str(args.q) || undefined;
      const documents = await searchDocumentation(
        {
          q,
          projectId,
          category: str(args.category) || undefined,
        },
        view.documents,
      );
      return {
        count: documents.length,
        documents: documents.map((doc) => compactDocument(doc, q)),
      };
    },

    get_document: async (args) => {
      let projectId = str(args.projectId) || undefined;
      const projectName = str(args.projectName);
      if (!projectId && projectName) {
        const project = await resolveProject(
          { name: projectName },
          view.projects,
        );
        if (!project)
          return {
            error: "No matching project found.",
            fallbackAction: BROWSE_PROJECTS_FALLBACK,
          };
        projectId = project.id;
      }
      const document = await resolveDocument(
        { ...args, projectId },
        view.documents,
      );
      if (!document)
        return {
          error: "No matching document found.",
          fallbackAction: BROWSE_PROJECTS_FALLBACK,
        };
      return {
        document: fullDocument(document),
        related: {
          href: `/projects/${document.projectId}`,
          name: document.projectName,
        },
      };
    },

    list_activity: async (args) => {
      let projectId = str(args.projectId) || undefined;
      const projectName = str(args.projectName);
      if (!projectId && projectName) {
        const project = await resolveProject(
          { name: projectName },
          view.projects,
        );
        if (!project)
          return {
            error: "No matching project found.",
            fallbackAction: BROWSE_PROJECTS_FALLBACK,
          };
        projectId = project.id;
      }
      const activities = await searchProjectActivities(
        {
          q: str(args.q) || undefined,
          projectId,
        },
        30,
        view.projects,
      );
      return { count: activities.length, activities };
    },

    get_dashboard: async () => {
      const [projects, ideaRows, insightSnap] = await Promise.all([
        allowed("projects", "view") ? listProjects({}, view.projects) : [],
        allowed("ideas", "view") ? listIdeas({}, view.ideas) : [],
        insightsAll ? getInsightSnapshot(CATALOG_INSIGHT_SCOPE) : null,
      ]);
      const insights = insightSnap ? insightsPulse(insightSnap) : null;
      return {
        dashboard: {
          projects: allowed("projects", "view")
            ? portfolioSnapshot(projects)
            : null,
          ideas: allowed("ideas", "view") ? ideasSnapshot(ideaRows) : null,
          insights: insights ? { saved: insights.total, ...insights } : null,
        },
        related: { href: "/", name: "Dashboard" },
      };
    },

    list_insights: async (args) => {
      let projectId = str(args.projectId) || undefined;
      const projectName = str(args.projectName);
      if (!projectId && projectName) {
        const project = await resolveProject(
          { name: projectName },
          view.projects,
        );
        if (!project)
          return {
            error: "No matching project found.",
            fallbackAction: BROWSE_PROJECTS_FALLBACK,
          };
        projectId = project.id;
      }
      const q = str(args.q) || undefined;
      const type = str(args.type) || undefined;
      const scope = projectId
        ? insightScope(projectId)
        : q
          ? undefined
          : CATALOG_INSIGHT_SCOPE;
      const insights = await listInsights({ q, scope, type });
      const generation = scope
        ? (await getInsightSnapshot(scope)).generation
        : null;
      return {
        count: insights.length,
        generation,
        insights: insights.map(compactInsight),
        related: {
          href: projectId ? `/projects/${projectId}` : "/insights",
          name: "Insights",
        },
      };
    },

    get_insight: async (args) => {
      const insight = await resolveInsight(args);
      if (!insight)
        return {
          error: "No matching insight found.",
          fallbackAction: OPEN_INSIGHTS_FALLBACK,
        };
      return { insight };
    },

    save_insight_as_idea: async (args) => {
      const insight = await resolveInsight(args);
      if (!insight)
        return {
          error: "No matching insight found.",
          fallbackAction: OPEN_INSIGHTS_FALLBACK,
        };
      try {
        const saved = await saveInsightAsIdea(insight.id);
        return {
          savedAsIdea: true,
          insight: compactInsight(saved),
          related: { href: "/ideas", name: "Ideas" },
        };
      } catch (error) {
        if (error instanceof InsightNotFoundError)
          return {
            error: "Insight not found.",
            fallbackAction: OPEN_INSIGHTS_FALLBACK,
          };
        throw error;
      }
    },

    generate_insights: async (args) => {
      let projectId = str(args.projectId) || undefined;
      const projectName = str(args.projectName);
      if (!projectId && projectName) {
        const project = await resolveProject(
          { name: projectName },
          view.projects,
        );
        if (!project)
          return {
            error: "No matching project found.",
            fallbackAction: BROWSE_PROJECTS_FALLBACK,
          };
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
          related: {
            href: projectId ? `/projects/${projectId}` : "/insights",
            name: "Insights",
          },
        };
      } catch (error) {
        if (error instanceof InsightsNotConfiguredError) {
          return {
            error:
              "AI is not configured, so I can't generate insights right now.",
            fallbackAction: OPEN_INSIGHTS_FALLBACK,
          };
        }
        if (error instanceof InsightsContextNotFoundError) {
          return {
            error: "Project not found.",
            fallbackAction: BROWSE_PROJECTS_FALLBACK,
          };
        }
        if (error instanceof InsightsResponseError || error instanceof Error) {
          return {
            error: "Couldn't generate insights right now.",
            fallbackAction: OPEN_INSIGHTS_FALLBACK,
          };
        }
        throw error;
      }
    },

    list_owners: async (args) => {
      const owners = await listOwners();
      const query = str(args.q);
      const matched = query
        ? owners.filter((owner) => ownerNameMatches(owner.name, query))
        : owners;
      return { count: matched.length, owners: matched };
    },

    set_appearance: async (args) => {
      const theme = str(args.theme) as ThemePreference;
      if (theme !== "light" && theme !== "dark" && theme !== "system") {
        return {
          error: "theme must be light, dark, or system.",
          fallbackAction: OPEN_SETTINGS_FALLBACK,
        };
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
        return {
          error: `Unknown page. Use one of: ${Object.keys(OPEN_PAGES).join(", ")}.`,
        };
      }
      return { opened: true, navAction: target };
    },

    ...teamHandlers,
    ...adminHandlers,
  };
}

/** Tool handlers for one signed-in user. Each is re-checked against the user's permissions at call time. */
export function createChatbotToolHandlers(ctx: ChatbotContext): ToolHandlerMap {
  const raw = buildRawHandlers(ctx);
  return Object.fromEntries(
    Object.entries(raw).map(([name, handler]) => {
      const guarded: ToolHandlerMap[string] = async (args) =>
        toolAvailable(name, ctx.user.permissions)
          ? handler(args)
          : {
              error: `Not allowed for this person's role: it needs ${describeRequirement(name)}.`,
              note: "Explain in your own words what is missing and what they CAN do instead. No stock phrases, no retrying.",
            };
      return [name, withFallback(guarded)];
    }),
  );
}

/** Tool definitions limited to what the user may use, so the model never offers forbidden actions. */
export function chatbotToolsFor(ctx: ChatbotContext) {
  return toolsFor(ctx.user.permissions, CHATBOT_TOOLS);
}
