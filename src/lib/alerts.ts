// Callouts and toggles are stored as Markdown block quotes that start with a marker line, the same convention GitHub
// uses for alerts:
//   > [!WARNING]
//   > Back up first.
// Any Markdown viewer shows a plain quote; ours draws a callout box or a collapsible section. Pure (no DOM).

export const CALLOUT_TYPES = ["info", "tip", "warning", "danger"] as const;
export type CalloutType = (typeof CALLOUT_TYPES)[number];

export const CALLOUT_META: Record<CalloutType, { label: string }> = {
  info: { label: "Info" },
  tip: { label: "Tip" },
  warning: { label: "Warning" },
  danger: { label: "Danger" },
};

export type AlertMarker = { kind: "callout"; type: CalloutType; rest: string } | { kind: "toggle"; rest: string };

/** Reads a leading "[!INFO]" / "[!TOGGLE]" marker. `rest` is the text after it. */
export function parseAlertMarker(text: string): AlertMarker | null {
  const m = /^\s*\[!(INFO|NOTE|TIP|WARNING|DANGER|TOGGLE)\][ \t]*\r?\n?/i.exec(text);
  if (!m) return null;
  const word = m[1].toLowerCase();
  const rest = text.slice(m[0].length);
  if (word === "toggle") return { kind: "toggle", rest };
  return { kind: "callout", type: word === "note" ? "info" : (word as CalloutType), rest };
}

export const alertMarkerLine = (type: CalloutType | "toggle") => `[!${type.toUpperCase()}]`;

/** Headings (levels 1-3) of a Markdown string, for a table of contents. Skips fenced code. */
export function markdownHeadings(markdown: string): { level: number; text: string; id: string }[] {
  const out: { level: number; text: string; id: string }[] = [];
  const used = new Map<string, number>();
  let fenced = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    if (fenced) continue;
    const m = /^(#{1,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!m) continue;
    const text = m[2].replace(/[*_`~[\]]/g, "").trim();
    out.push({ level: m[1].length, text, id: headingId(text, used) });
  }
  return out;
}

/** A URL-safe id for a heading; repeated headings get -1, -2… so ids stay unique. */
export function headingId(text: string, used: Map<string, number>): string {
  const base = text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "") || "section";
  const n = used.get(base) ?? 0;
  used.set(base, n + 1);
  return n === 0 ? base : `${base}-${n}`;
}

export const TOC_MARKER = "[TOC]";
