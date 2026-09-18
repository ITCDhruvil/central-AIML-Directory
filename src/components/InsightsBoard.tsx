"use client";

import { useState } from "react";
import { ChevronDown, Loader2, Sparkles } from "lucide-react";
import { InsightCard } from "@/components/InsightCard";
import { formatCardDateTime } from "@/components/ContentCard";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatGenerationSummary } from "@/lib/insightMerge";
import type { Insight, InsightGeneration, InsightSnapshot } from "@/types/insight";

const INSIGHT_GRID = "grid grid-cols-1 gap-4 lg:grid-cols-2";

function showChangeBadges(snapshot: InsightSnapshot): boolean {
  const { insights } = snapshot;
  const hasAdded = insights.some((insight) => insight.lastChange === "added");
  const hasOther = insights.some((insight) => insight.lastChange !== "added");
  return insights.some((insight) => insight.lastChange === "updated") || (hasAdded && hasOther);
}

function isFirstFill(snapshot: InsightSnapshot): boolean {
  return (
    snapshot.generation !== null &&
    snapshot.generation.updatedCount === 0 &&
    snapshot.insights.length > 0 &&
    snapshot.insights.every((insight) => insight.lastChange === "added")
  );
}

function GenerationStatus({ generation, defaultOpen }: { generation: InsightGeneration; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-zinc-200 bg-white text-sm dark:border-zinc-800 dark:bg-zinc-900">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-inset dark:text-zinc-200"
      >
        {formatGenerationSummary(generation)}
        <ChevronDown size={16} className={cn("shrink-0 text-zinc-400 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul className="space-y-1 border-t border-zinc-100 px-5 py-3 text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
          {generation.updatedTitles.map((title) => (
            <li key={`updated-${title}`}>Updated {title.trim()}</li>
          ))}
          {generation.addedTitles.map((title) => (
            <li key={`added-${title}`}>Added {title.trim()}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function InsightsBoard({
  projectId,
  initial,
  emptyPrompt,
  layout = "page",
}: {
  projectId?: string;
  initial: InsightSnapshot;
  emptyPrompt: string;
  layout?: "page" | "panel";
}) {
  const [snapshot, setSnapshot] = useState<InsightSnapshot>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ledgerEpoch, setLedgerEpoch] = useState(0);

  const { insights, generation } = snapshot;
  const improvements = insights.filter((insight) => insight.type === "improvement");
  const newIdeas = insights.filter((insight) => insight.type === "new_idea");
  const hasInsights = insights.length > 0;
  const showChange = showChangeBadges(snapshot);
  const showLedger = Boolean(generation && !isFirstFill(snapshot) && (generation.addedTitles.length > 0 || generation.updatedTitles.length > 0));
  const TitleTag = layout === "panel" ? "h2" : "h1";

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectId ? { projectId } : {}),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Failed to generate insights");
        return;
      }
      setSnapshot({ insights: body.insights, generation: body.generation });
      setLedgerEpoch((n) => n + 1);
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  function handleSaved(updated: Insight) {
    setSnapshot((current) => ({
      ...current,
      insights: current.insights.map((insight) => (insight.id === updated.id ? updated : insight)),
    }));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <TitleTag className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {projectId ? "Suggest improvements" : "Insights"}
          </TitleTag>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {projectId
              ? "Concrete next moves for this project, grounded in a live search."
              : "Next moves across the directory, grounded in a live search."}
          </p>
          {generation && (
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Last generated {formatCardDateTime(generation.generatedAt)} UTC
            </p>
          )}
        </div>
        <Button variant="primary" icon={loading ? undefined : Sparkles} loading={loading} onClick={generate}>
          {loading ? "Searching and thinking..." : hasInsights ? "Regenerate" : "Generate insights"}
        </Button>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>
      )}

      {showLedger && generation && (
        <GenerationStatus key={`${generation.id}-${ledgerEpoch}`} generation={generation} defaultOpen={ledgerEpoch > 0} />
      )}

      {loading && !hasInsights && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 py-16 text-center dark:border-zinc-700">
          <Loader2 size={22} className="animate-spin text-zinc-400" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Looking at the work, then checking what is current.</p>
        </div>
      )}

      {!hasInsights && !loading && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 py-16 text-center dark:border-zinc-700">
          <Sparkles size={22} className="text-zinc-300 dark:text-zinc-600" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{emptyPrompt}</p>
        </div>
      )}

      {hasInsights && (
        <div className="space-y-8">
          {loading && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Refreshing cards. Earlier suggestions stay until this run finishes.</p>
          )}
          {improvements.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Improve what you have
                <span className="ml-2 font-normal text-zinc-400">{improvements.length}</span>
              </h2>
              <div className={INSIGHT_GRID}>
                {improvements.map((insight) => (
                  <InsightCard key={insight.id} insight={insight} showChange={showChange} onSaved={handleSaved} />
                ))}
              </div>
            </section>
          )}
          {newIdeas.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                New ideas worth exploring
                <span className="ml-2 font-normal text-zinc-400">{newIdeas.length}</span>
              </h2>
              <div className={INSIGHT_GRID}>
                {newIdeas.map((insight) => (
                  <InsightCard key={insight.id} insight={insight} showChange={showChange} onSaved={handleSaved} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
