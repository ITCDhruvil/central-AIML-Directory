import type { ToolDefinition } from "@/lib/ai/chatTypes";
import { MEMBER_ROLES } from "@/lib/auth/membership";

const PROJECT = {
  type: "string",
  description: "The project's id or name.",
} as const;

const PERSON = {
  type: "string",
  description: "The person's name or email. Only people with an account can be on a team. If several people match you get a list back — ask which one.",
} as const;

/** Project team tools: who works on a project and in what role. */
export const TEAM_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "get_project_team",
      description:
        "Show who is on a project's team and each person's role: Owner (manages the project and team), Contributor (can edit) or Viewer (read-only).",
      parameters: { type: "object", properties: { project: PROJECT }, required: ["project"] },
    },
  },
  {
    type: "function",
    function: {
      name: "set_project_member",
      description:
        "Add a person to a project's team, or change their role if they are already on it — call this directly for \"add X\", \"make X a viewer/contributor/owner\" or \"give X access\"; " +
        "it adds them if they aren't on the team yet, so don't check the team first and don't ask for confirmation — an explicit request is enough. Roles: OWNER, EDIT (Contributor), VIEW (Viewer). " +
        "Ask which role if it isn't clear — don't guess. Only the project's owners (or a manager) can change a team, and a team always needs at least one Owner.",
      parameters: {
        type: "object",
        properties: { project: PROJECT, person: PERSON, role: { type: "string", enum: [...MEMBER_ROLES] } },
        required: ["project", "person", "role"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remove_project_member",
      description:
        "Remove a person from a project's team. Only the project's owners (or a manager) can do this, and the last Owner can't be removed.",
      parameters: { type: "object", properties: { project: PROJECT, person: PERSON }, required: ["project", "person"] },
    },
  },
];
