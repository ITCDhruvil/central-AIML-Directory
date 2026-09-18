const MAX_TEXT_LENGTH = 8000;

export interface ParsedTextTransform {
  text: string;
}

/** Same never-trust-the-model discipline as responseValidator.ts, for the text-transform response shape. */
export function parseTextTransformResponse(raw: string): ParsedTextTransform | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const data = parsed as Record<string, unknown>;

  if (typeof data.text !== "string" || !data.text.trim()) return null;
  return { text: data.text.trim().slice(0, MAX_TEXT_LENGTH) };
}
