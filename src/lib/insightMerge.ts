import type { Suggestion } from "@/lib/ai/insightsValidator";

export type InsightChange = "added" | "updated" | "unchanged";

export interface InsightMergeRecord {
  id: string;
  fingerprint: string;
  type: Suggestion["type"];
  title: string;
  reasoning: string;
  suggestedTool: string | null;
  relatedProjectName: string | null;
  sourceUrls: string[];
}

export interface InsightCreatePlan {
  fingerprint: string;
  suggestion: Suggestion;
}

export interface InsightUpdatePlan {
  existing: InsightMergeRecord;
  suggestion: Suggestion;
  fingerprint: string;
  changed: boolean;
}

export interface InsightMergePlan {
  create: InsightCreatePlan[];
  update: InsightUpdatePlan[];
}

export interface InsightMergeSummary {
  addedCount: number;
  updatedCount: number;
  unchangedCount: number;
  addedTitles: string[];
  updatedTitles: string[];
}

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Stable identity for regenerate-in-place. Title is ignored so a rewrite updates the same card. */
export function insightFingerprint(suggestion: Suggestion): string {
  const tool = normalize(suggestion.suggestedTool);
  const related = normalize(suggestion.relatedProjectName);
  const title = normalize(suggestion.title);
  if (suggestion.type === "improvement") {
    return ["improvement", related, tool || title].join("|");
  }
  return ["new_idea", tool || title].join("|");
}

function sameSources(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((url, i) => url === b[i]);
}

export function insightContentChanged(existing: InsightMergeRecord, incoming: Suggestion): boolean {
  return (
    existing.title !== incoming.title ||
    existing.reasoning !== incoming.reasoning ||
    existing.suggestedTool !== incoming.suggestedTool ||
    existing.relatedProjectName !== incoming.relatedProjectName ||
    !sameSources(existing.sourceUrls, incoming.sourceUrls)
  );
}

function titleKey(item: { type: Suggestion["type"]; title: string }): string {
  return `${item.type}|title|${normalize(item.title)}`;
}

export function planInsightMerge(existing: InsightMergeRecord[], incoming: Suggestion[]): InsightMergePlan {
  const byFingerprint = new Map(existing.map((row) => [row.fingerprint, row]));
  const byTitle = new Map(existing.map((row) => [titleKey(row), row]));
  const seen = new Set<string>();
  const claimed = new Set<string>();
  const create: InsightCreatePlan[] = [];
  const update: InsightUpdatePlan[] = [];

  for (const suggestion of incoming) {
    const fingerprint = insightFingerprint(suggestion);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);

    const previous = [byFingerprint.get(fingerprint), byTitle.get(titleKey(suggestion))].find(
      (row) => row && !claimed.has(row.id),
    );
    if (!previous) {
      create.push({ fingerprint, suggestion });
      continue;
    }
    const fingerprintTaken = existing.some((row) => row.fingerprint === fingerprint && row.id !== previous.id);
    const nextFingerprint = fingerprintTaken ? previous.fingerprint : fingerprint;
    claimed.add(previous.id);
    update.push({
      existing: previous,
      suggestion,
      fingerprint: nextFingerprint,
      changed: previous.fingerprint !== nextFingerprint || insightContentChanged(previous, suggestion),
    });
  }

  return { create, update };
}

export function summarizeMerge(plan: InsightMergePlan): InsightMergeSummary {
  const addedTitles = plan.create.map((item) => item.suggestion.title);
  const updatedTitles = plan.update.filter((item) => item.changed).map((item) => item.suggestion.title);
  return {
    addedCount: addedTitles.length,
    updatedCount: updatedTitles.length,
    unchangedCount: plan.update.filter((item) => !item.changed).length,
    addedTitles,
    updatedTitles,
  };
}

export function formatGenerationSummary(summary: Pick<InsightMergeSummary, "addedCount" | "updatedCount">): string {
  const { addedCount, updatedCount } = summary;
  if (addedCount === 0 && updatedCount === 0) return "That run left every card as it was.";
  const parts: string[] = [];
  if (addedCount > 0) parts.push(`added ${addedCount}`);
  if (updatedCount > 0) parts.push(`updated ${updatedCount}`);
  return `That run ${parts.join(" and ")}.`;
}
