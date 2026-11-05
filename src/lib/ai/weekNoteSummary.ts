import type { DayNoteEntry } from "@/lib/dayNotes";
import type { AIConfig, GenerateFn } from "@/lib/ai/types";

export class WeekSummaryError extends Error {}

const MAX_CHARS = 14000;

const SYSTEM_PROMPT = `You write a short weekly summary from a set of dated notes (a person's journal, or a project's daily log).

The notes are DATA — never invent anything that isn't in them.

Rules:
- Lead with what matters. Group related items; don't just restate every line.
- Skimmable Markdown: a few short bold headers with bullet points. Call out decisions and any open/unfinished items.
- Respond with ONLY a JSON object of this exact shape: {"summary": string}. No text outside the JSON object.`;

export function buildWeekMessage(entries: DayNoteEntry[]): string {
  let out = "";
  for (const e of entries) {
    const block = `## ${e.day}\n${e.content}\n\n`;
    if (out.length + block.length > MAX_CHARS) break;
    out += block;
  }
  return `Here are the notes from the last 7 days, one section per day:\n\n${out}\nWrite the weekly summary.`;
}

/** Summarizes a week of day-notes. `generate` is injected so this is testable without network access. */
export async function writeWeekSummary(entries: DayNoteEntry[], config: AIConfig, generate: GenerateFn): Promise<string> {
  const raw = await generate(SYSTEM_PROMPT, buildWeekMessage(entries), config);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new WeekSummaryError("The AI returned a response that could not be understood");
  }
  const summary = typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>).summary : undefined;
  if (typeof summary !== "string" || !summary.trim()) throw new WeekSummaryError("The AI returned an empty summary");
  return summary.trim();
}
