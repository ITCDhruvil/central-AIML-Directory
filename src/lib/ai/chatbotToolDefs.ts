import type { ToolDefinition } from "@/lib/ai/chatTypes";
import { ADMIN_TOOLS } from "@/lib/ai/chatbotAdminToolDefs";
import { TEAM_TOOLS } from "@/lib/ai/chatbotTeamToolDefs";
import { DOCUMENT_CATEGORIES } from "@/types/documentation";
import { IDEA_STATUSES } from "@/types/idea";
import { INSIGHT_TYPES } from "@/types/insight";
import { PROJECT_STAGES, PROJECT_STATUSES, PROJECT_TYPES } from "@/types/project";

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

export const OPEN_PAGES = {
  dashboard: { href: "/", label: "Open dashboard" },
  projects: { href: "/projects", label: "Browse projects" },
  ideas: { href: "/ideas", label: "Browse ideas" },
  insights: { href: "/insights", label: "Open insights" },
  settings: { href: "/settings", label: "Open settings" },
  new_project: { href: "/projects/new", label: "Open New Project form" },
  new_idea: { href: "/ideas/new", label: "Open New Idea form" },
} as const;

const BASE_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "search_workspace",
      description:
        "Search the whole workspace in one call: projects, ideas, documentation, insights, owners, and activity. Use when the user is looking something up and you don't know which model it lives on. q matches every text field in the schema.",
      parameters: {
        type: "object",
        properties: {
          q: {
            type: "string",
            description:
              "Free-text over every field: names, slugs, descriptions, owners, type/status/stage, tags, technologies, GitHub URLs/repos, deployment URLs, documentation title/path/content, insight titles/reasoning, activity titles.",
          },
        },
        required: ["q"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_projects",
      description:
        "List or search projects. q matches every project field (name, slug, description, type, status, stage, owner, GitHub URL/owner/repo/branch, technologies, tags, deployment URLs) plus related documentation and activity. Owner matching is partial — 'Devika' finds 'Devika S Vinod'.",
      parameters: {
        type: "object",
        properties: {
          q: {
            type: "string",
            description:
              "Free-text over every project field including technologies, tags, GitHub, deployment URLs, documentation, and activity.",
          },
          owner: { type: "string", description: "Person name on the project owner field. First names and partial names match." },
          type: { type: "string", enum: [...PROJECT_TYPES] },
          status: { type: "string", enum: [...PROJECT_STATUSES] },
          stage: { type: "string", enum: [...PROJECT_STAGES] },
          tag: { type: "string", description: "Match a tag substring" },
          technology: { type: "string", description: "Match a technology name substring" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_project",
      description:
        "Get the full project record: every field plus documentation titles and recent activity. Lookup by id or name.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" }, name: { type: "string" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_project_from_github",
      description:
        "Given a GitHub repository URL, fetches the repo and drafts a project name, description, and technology list from its README and file structure. Does NOT save anything — show the draft to the user and get their OK before calling create_project. Call this the moment the user gives you a GitHub URL while creating a project.",
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
      description:
        "Creates and saves a new project. Only `name` is required. Prefer calling draft_project_from_github first and passing its draft values through here when the user has a GitHub repo.",
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
      description:
        "Updates one or more fields on an existing project — e.g. change status, stage, owner, description, tags, or technologies. Only include fields that are actually changing.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "Project id from list_projects/get_project" },
          name: { type: "string" },
          ...PROJECT_FIELD_PROPERTIES,
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_project",
      description:
        "Permanently deletes a project. DESTRUCTIVE. A message like 'Delete BuildTrack' is a request, not confirmation. Always call first with confirm omitted or false so Yes/Cancel buttons appear. Only call again with confirm:true after the user clicks Yes or writes 'Yes, delete …'.",
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
      name: "list_ideas",
      description:
        "List or search ideas. q matches every idea field (name, slug, description, status, owner, technologies, tags, promoted project id). Owner matching is partial — 'Devika' finds 'Devika S Vinod'.",
      parameters: {
        type: "object",
        properties: {
          q: {
            type: "string",
            description: "Free-text over every idea field including technologies, tags, status, and promoted project id.",
          },
          owner: { type: "string", description: "Person name on the idea owner field. First names and partial names match." },
          status: { type: "string", enum: [...IDEA_STATUSES] },
          tag: { type: "string", description: "Match a tag substring" },
          technology: { type: "string", description: "Match a technology name substring" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_idea",
      description: "Get the full idea record (every field) by id or by name.",
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
      description:
        "Turns an idea into a real project (copies name/description/tags/tech, marks the idea PROMOTED). DESTRUCTIVE to the idea's status. Call once with confirm omitted or false first. Only call again with confirm:true after the user explicitly confirms.",
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
      description:
        "Permanently deletes an idea. DESTRUCTIVE. Call once with confirm omitted or false first. Only call again with confirm:true after the user explicitly confirms.",
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
      name: "list_documents",
      description:
        "Search project documentation (read-only). q matches title, category, file path, content, and source. Does not edit or sync docs.",
      parameters: {
        type: "object",
        properties: {
          q: { type: "string", description: "Free-text over documentation title, category, file path, content, and source." },
          projectId: { type: "string" },
          projectName: { type: "string" },
          category: { type: "string", enum: [...DOCUMENT_CATEGORIES] },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_document",
      description: "Read one documentation page (full content) by id, or by title plus project. Read-only — do not invent edits.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          projectId: { type: "string" },
          projectName: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_activity",
      description: "List project activity (created, updated, GitHub synced, docs updated, deployments). q matches type and title.",
      parameters: {
        type: "object",
        properties: {
          q: { type: "string", description: "Free-text over activity type and title." },
          projectId: { type: "string" },
          projectName: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_dashboard",
      description:
        "Workspace snapshot for the dashboard: project counts by status plus GitHub/deploy coverage, idea counts by status, and saved insights (new ideas vs improvements, last generated). Use this for 'how's the portfolio', 'summarize the dashboard', or overview questions.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_insights",
      description:
        "List saved AI insights. q matches title, reasoning, suggested tool, related project, source URLs, type, and last change. Omit project filters to search the catalog (or the whole set when q is set).",
      parameters: {
        type: "object",
        properties: {
          q: {
            type: "string",
            description: "Free-text over insight title, reasoning, suggested tool, related project name, and source URLs.",
          },
          type: { type: "string", enum: [...INSIGHT_TYPES] },
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
      description:
        "Runs the Insights generator (catalog-wide, or for one project) and saves the results. Slow — it may search the web. Tell the user you're generating, then call this. Do not invent insights yourself.",
      parameters: {
        type: "object",
        properties: { projectId: { type: "string" }, projectName: { type: "string" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_owners",
      description:
        "List saved owner names used on project and idea forms. Pass q to match a first name or partial name (e.g. 'Devika' returns 'Devika S Vinod'). Use this when a people search on list_projects/list_ideas comes back empty, then retry with the closest saved name.",
      parameters: {
        type: "object",
        properties: {
          q: { type: "string", description: "Optional person-name query. Partial and first-name matches." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_appearance",
      description:
        "Change this browser's appearance (light, dark, or system). Settings are local to this device — the tool asks the chat UI to apply the theme.",
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
      description:
        "Open a real app page (dashboard, projects, ideas, insights, settings, or a new-item form) via a button under your reply. Use when the user asks to go somewhere, or when they need a form you shouldn't fake in chat.",
      parameters: {
        type: "object",
        properties: { page: { type: "string", enum: Object.keys(OPEN_PAGES) } },
        required: ["page"],
      },
    },
  },
];

/** Every tool the chatbot knows. Which ones a given user is offered is decided by chatbotAccess.toolsFor. */
export const CHATBOT_TOOLS: ToolDefinition[] = [...BASE_TOOLS, ...TEAM_TOOLS, ...ADMIN_TOOLS];
