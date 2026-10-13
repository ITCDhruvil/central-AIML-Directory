import { parseGitHubRepoUrl } from "@/lib/github/parseUrl";
import type { ColumnId } from "@/lib/projectTable";
import { PROJECT_STAGES } from "@/types/project";
import type { Technology } from "@/types/technology";

/** Columns that can be empty on a project, and so can be filled in straight from the table. */
export const EDITABLE_WHEN_EMPTY: ColumnId[] = ["technologies", "stage", "owner", "tags", "github", "deployment", "branch"];

export function isEditableWhenEmpty(column: ColumnId): boolean {
  return EDITABLE_WHEN_EMPTY.includes(column);
}

type Result = { ok: true; patch: Record<string, unknown> } | { ok: false; error: string };

function uniqueTrimmed(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = raw.trim();
    if (value && !seen.has(value.toLowerCase())) {
      seen.add(value.toLowerCase());
      out.push(value);
    }
  }
  return out;
}

/**
 * Turns what someone typed into a cell into the partial update the project API expects, or an error message.
 * Single-value columns take a string, list columns (technologies, tags) take a string[].
 */
export function buildCellPatch(column: ColumnId, input: string | string[]): Result {
  const text = typeof input === "string" ? input.trim() : "";
  const list = Array.isArray(input) ? uniqueTrimmed(input) : [];

  switch (column) {
    case "owner":
      return text ? { ok: true, patch: { owner: text } } : { ok: false, error: "Enter a name." };

    case "stage":
      return (PROJECT_STAGES as readonly string[]).includes(text)
        ? { ok: true, patch: { stage: text } }
        : { ok: false, error: "Choose a stage." };

    case "branch":
      return /^[\w./-]+$/.test(text)
        ? { ok: true, patch: { defaultBranch: text } }
        : { ok: false, error: "Enter a branch name like main or release/1.0." };

    case "github": {
      const parsed = parseGitHubRepoUrl(text);
      if (!parsed) return { ok: false, error: "Enter a GitHub repository URL like https://github.com/owner/repo." };
      return {
        ok: true,
        patch: {
          githubUrl: `https://github.com/${parsed.owner}/${parsed.repo}`,
          githubOwner: parsed.owner,
          githubRepo: parsed.repo,
        },
      };
    }

    case "deployment": {
      try {
        const url = new URL(text);
        if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("protocol");
        return { ok: true, patch: { deploymentUrls: [text] } };
      } catch {
        return { ok: false, error: "Enter a full web address starting with http:// or https://." };
      }
    }

    case "technologies": {
      if (list.length === 0) return { ok: false, error: "Add at least one technology." };
      const technologies: Technology[] = list.map((name) => ({ name, category: "OTHER", evidence: ["manual"], confidence: "HIGH" }));
      return { ok: true, patch: { technologies } };
    }

    case "tags":
      return list.length > 0 ? { ok: true, patch: { tags: list } } : { ok: false, error: "Add at least one tag." };

    default:
      return { ok: false, error: "This column can't be edited here." };
  }
}
