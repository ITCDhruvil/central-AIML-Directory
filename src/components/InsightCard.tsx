"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { CARD_CTA_CLASS, formatCardDate } from "@/components/ContentCard";
import { cn } from "@/lib/cn";
import type { Insight } from "@/types/insight";

const TONE_PANEL: Record<Insight["type"], string> = {
  improvement: "bg-sky-100 dark:bg-sky-500/15",
  new_idea: "bg-amber-100 dark:bg-amber-500/15",
};

function sourceLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function insightWhen(insight: Insight): string {
  const first = formatCardDate(insight.firstGeneratedAt);
  const last = formatCardDate(insight.lastGeneratedAt);
  if (first === last) return `Generated ${first}`;
  return `Generated ${first}, updated ${last}`;
}

export function InsightCard({
  insight,
  showChange,
  onSaved,
}: {
  insight: Insight;
  showChange: boolean;
  onSaved?: (insight: Insight) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saved = insight.savedAsIdea;
  const isImprovement = insight.type === "improvement";

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/insights/${insight.id}/save-as-idea`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Failed to save");
        return;
      }
      onSaved?.(body.insight as Insight);
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="flex h-full flex-col rounded-lg border border-zinc-200/80 bg-white p-1.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className={cn("relative flex min-h-0 flex-1 flex-col rounded-md px-5 pb-5 pt-4", TONE_PANEL[insight.type])}>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-white/70 px-2.5 py-0.5 text-[11px] font-medium text-zinc-500 dark:bg-zinc-950/40 dark:text-zinc-300">
            {isImprovement ? "Improvement" : "New idea"}
          </span>
          {insight.relatedProjectName && (
            <span className="rounded-full bg-white/70 px-2.5 py-0.5 text-[11px] font-medium text-zinc-500 dark:bg-zinc-950/40 dark:text-zinc-300">
              {insight.relatedProjectName}
            </span>
          )}
          {showChange && insight.lastChange === "added" && (
            <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-[11px] font-medium text-orange-800 dark:bg-orange-500/20 dark:text-orange-300">
              New
            </span>
          )}
          {showChange && insight.lastChange === "updated" && (
            <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-[11px] font-medium text-orange-800 dark:bg-orange-500/20 dark:text-orange-300">
              Updated
            </span>
          )}
        </div>

        <h3 className="mt-3 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{insight.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{insight.reasoning}</p>

        {(insight.suggestedTool || insight.sourceUrls.length > 0) && (
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-600 dark:text-zinc-300">
            {insight.suggestedTool && <span>{insight.suggestedTool}</span>}
            {insight.sourceUrls.map((url) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-zinc-900 hover:underline dark:hover:text-zinc-100"
              >
                {sourceLabel(url)}
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <p className="min-w-0 truncate text-sm text-zinc-500 dark:text-zinc-400">{insightWhen(insight)}</p>
        <div className="flex shrink-0 items-center gap-2">
          {error && <span className="text-xs text-red-600">{error}</span>}
          <button type="button" className={CARD_CTA_CLASS} disabled={saved || saving} onClick={handleSave}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : null}
            {saving ? "Saving..." : saved ? "Saved as idea" : "Save as idea"}
          </button>
        </div>
      </div>
    </article>
  );
}
