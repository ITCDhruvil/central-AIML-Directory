import type { AutofillTarget } from "@/lib/ai/importAutofillPrompts";

export interface ParsedNameAutofill {
  target: "name";
  name: string;
}

export interface ParsedDescriptionAutofill {
  target: "description";
  description: string;
}

export interface ParsedTagsAutofill {
  target: "tags";
  tags: string[];
}

export interface ParsedTechnologiesAutofill {
  target: "technologies";
  suggestedTechnologies: string[];
}

export interface ParsedAllAutofill {
  target: "all";
  name: string;
  description: string;
  tags: string[];
  suggestedTechnologies: string[];
}

export type ParsedImportAutofill =
  | ParsedNameAutofill
  | ParsedDescriptionAutofill
  | ParsedTagsAutofill
  | ParsedTechnologiesAutofill
  | ParsedAllAutofill;

const MAX_DESCRIPTION_LENGTH = 4000; // several Markdown paragraphs + a feature list — see IMPORT_AUTOFILL_SYSTEM_PROMPT
const MAX_NAME_LENGTH = 120;
const MAX_TAG_LENGTH = 40;
const MAX_TAGS = 6;
const MAX_SUGGESTED_TECHNOLOGIES = 8;

function cleanStringList(value: unknown, maxItems: number, maxLen: number): string[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every((t): t is string => typeof t === "string")) return null;
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    const trimmed = item.trim().slice(0, maxLen);
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
    if (result.length >= maxItems) break;
  }
  return result;
}

/** Same never-trust-the-model discipline as responseValidator.ts, for the import-autofill response shape. */
export function parseImportAutofillResponse(raw: string, target: AutofillTarget): ParsedImportAutofill | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const data = parsed as Record<string, unknown>;

  if (target === "name") {
    if (typeof data.name !== "string") return null;
    return { target, name: data.name.trim().slice(0, MAX_NAME_LENGTH) };
  }

  if (target === "description") {
    if (typeof data.description !== "string") return null;
    return { target, description: data.description.trim().slice(0, MAX_DESCRIPTION_LENGTH) };
  }

  if (target === "tags") {
    const tags = cleanStringList(data.tags, MAX_TAGS, MAX_TAG_LENGTH);
    if (!tags) return null;
    return { target, tags };
  }

  if (target === "technologies") {
    const suggestedTechnologies = cleanStringList(
      data.suggestedTechnologies,
      MAX_SUGGESTED_TECHNOLOGIES,
      MAX_NAME_LENGTH,
    );
    if (!suggestedTechnologies) return null;
    return { target, suggestedTechnologies };
  }

  if (typeof data.name !== "string" || typeof data.description !== "string") return null;
  const tags = cleanStringList(data.tags, MAX_TAGS, MAX_TAG_LENGTH);
  const suggestedTechnologies = cleanStringList(
    data.suggestedTechnologies,
    MAX_SUGGESTED_TECHNOLOGIES,
    MAX_NAME_LENGTH,
  );
  if (!tags || !suggestedTechnologies) return null;

  return {
    target: "all",
    name: data.name.trim().slice(0, MAX_NAME_LENGTH),
    description: data.description.trim().slice(0, MAX_DESCRIPTION_LENGTH),
    tags,
    suggestedTechnologies,
  };
}
