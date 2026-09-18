"use client";

import { useEffect, useState } from "react";
import { InsightsBoard } from "@/components/InsightsBoard";
import type { InsightSnapshot } from "@/types/insight";

const EMPTY_SNAPSHOT: InsightSnapshot = { insights: [], generation: null };

/** Per-project version of Insights — same saved cards, scoped to one project. */
export function SuggestImprovementsPanel({ projectId }: { projectId: string }) {
  const [initial, setInitial] = useState<InsightSnapshot>(EMPTY_SNAPSHOT);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/insights?projectId=${encodeURIComponent(projectId)}`)
      .then(async (res) => {
        const body = await res.json();
        if (!cancelled && res.ok) {
          setInitial({ insights: body.insights ?? [], generation: body.generation ?? null });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (!ready) {
    return <p className="text-sm text-zinc-400">Loading saved suggestions...</p>;
  }

  return (
    <InsightsBoard
      layout="panel"
      projectId={projectId}
      initial={initial}
      emptyPrompt="Generate to see concrete improvements for this project."
    />
  );
}
