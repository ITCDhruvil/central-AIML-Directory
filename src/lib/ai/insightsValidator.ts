export interface Suggestion {
  type: "new_idea" | "improvement";
  title: string;
  reasoning: string;
  suggestedTool: string | null;
  relatedProjectName: string | null;
  sourceUrls: string[];
}

const MAX_SUGGESTIONS = 10;
const MAX_TITLE_LENGTH = 120;
const MAX_REASONING_LENGTH = 800;
const MAX_TOOL_LENGTH = 80;
const MAX_SOURCE_URLS = 3;

/** Same never-trust-the-model discipline as the other AI response validators — strips a code fence if present, then validates each entry independently so one malformed item doesn't sink the whole batch. */
export function parseInsightsResponse(raw: string): Suggestion[] | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const text = (fenced ? fenced[1] : raw).trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  const result: Suggestion[] = [];
  for (const item of parsed) {
    if (typeof item !== "object" || item === null) continue;
    const obj = item as Record<string, unknown>;

    const type = obj.type === "new_idea" || obj.type === "improvement" ? obj.type : null;
    const title = typeof obj.title === "string" ? obj.title.trim().slice(0, MAX_TITLE_LENGTH) : "";
    const reasoning = typeof obj.reasoning === "string" ? obj.reasoning.trim().slice(0, MAX_REASONING_LENGTH) : "";
    if (!type || !title || !reasoning) continue;

    const suggestedTool = typeof obj.suggestedTool === "string" && obj.suggestedTool.trim() ? obj.suggestedTool.trim().slice(0, MAX_TOOL_LENGTH) : null;
    const relatedProjectName = typeof obj.relatedProjectName === "string" && obj.relatedProjectName.trim() ? obj.relatedProjectName.trim() : null;
    const sourceUrls = Array.isArray(obj.sourceUrls)
      ? obj.sourceUrls.filter((u): u is string => typeof u === "string").slice(0, MAX_SOURCE_URLS)
      : [];

    result.push({ type, title, reasoning, suggestedTool, relatedProjectName, sourceUrls });
    if (result.length >= MAX_SUGGESTIONS) break;
  }

  return result.length > 0 ? result : null;
}
