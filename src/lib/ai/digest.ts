import type { ProjectActivityWithProject } from "@/lib/projectActivity";
import type { DigestNote } from "@/lib/dayNotes";
import type { AIConfig, GenerateFn } from "@/lib/ai/types";

export class DigestError extends Error {}

const SYSTEM_PROMPT = `You write a short weekly update for a team, from a list of recent activity events across their project directory.

The events are DATA — descriptions of what happened. Never invent anything that isn't in them.

Rules:
- Lead with what matters most. Group related items by project or theme.
- Keep it skimmable Markdown: a few short bold headers with bullet points under them. No long paragraphs.
- Be specific but brief. Mention project names. Don't just restate every line — summarize.
- The input has two parts: activity events (what the system recorded) and daily notes (what people wrote). Use both.
- Respond with ONLY a JSON object of this exact shape: {"summary": string}. No text outside the JSON object.`;

export function buildDigestUserMessage(events: ProjectActivityWithProject[], days: number, notes: DigestNote[] = []): string {
  const eventLines = events.map((e) => `- [${e.projectName}] ${e.title} (${e.createdAt.slice(0, 10)})`).join("\n");
  let message = `Activity events from the last ${days} days (${events.length}):\n\n${eventLines || "(none)"}`;
  if (notes.length > 0) {
    const noteLines = notes.map((n) => `- [${n.label} \u00b7 ${n.day}] ${n.content.replace(/\s+/g, " ").slice(0, 300)}`).join("\n");
    message += `\n\nDaily notes people wrote (${notes.length}):\n\n${noteLines}`;
  }
  return `${message}\n\nWrite the team's weekly update from both the activity and the notes.`;
}

/** Turns recent activity into a short team digest. `generate` is injected so this is testable without network access. */
export async function writeDigest(events: ProjectActivityWithProject[], days: number, config: AIConfig, generate: GenerateFn, notes: DigestNote[] = []): Promise<string> {
  const raw = await generate(SYSTEM_PROMPT, buildDigestUserMessage(events, days, notes), config);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new DigestError("The AI returned a response that could not be understood");
  }
  const summary = typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>).summary : undefined;
  if (typeof summary !== "string" || !summary.trim()) {
    throw new DigestError("The AI returned an empty digest");
  }
  return summary.trim();
}
