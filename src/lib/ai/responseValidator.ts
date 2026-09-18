const LABEL_PATTERN = /^DOC-\d+$/;

export interface ParsedAssistantResponse {
  answer: string;
  citationLabels: string[];
}

/**
 * Parses and validates the raw JSON text returned by the model. Never trusts
 * the model's output shape — anything malformed (not JSON, missing fields,
 * wrong types, a citation that isn't a well-formed label) is rejected here so
 * the caller can fail safely instead of forwarding garbage to the browser.
 */
export function parseAssistantResponse(raw: string): ParsedAssistantResponse | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const data = parsed as Record<string, unknown>;

  if (typeof data.answer !== "string" || !data.answer.trim()) return null;
  if (!Array.isArray(data.citations)) return null;
  if (!data.citations.every((c): c is string => typeof c === "string" && LABEL_PATTERN.test(c))) return null;

  return { answer: data.answer, citationLabels: data.citations };
}
