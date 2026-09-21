import type { Idea, IdeaStatus } from "@/types/idea";
import type { InsightSnapshot } from "@/types/insight";

export interface IdeasSnapshot {
  total: number;
  byStatus: Record<IdeaStatus, number>;
}

export interface InsightsPulse {
  total: number;
  newIdeas: number;
  improvements: number;
  unsaved: number;
  lastGeneratedAt: string | null;
}

const EMPTY_IDEA_STATUS: Record<IdeaStatus, number> = {
  ACTIVE: 0,
  ON_HOLD: 0,
  PROMOTED: 0,
  ARCHIVED: 0,
};

/** Status mix for the ideas KPI — same list the Ideas page already filters on. */
export function ideasSnapshot(ideas: Idea[]): IdeasSnapshot {
  const byStatus = { ...EMPTY_IDEA_STATUS };
  for (const idea of ideas) {
    byStatus[idea.status] += 1;
  }
  return { total: ideas.length, byStatus };
}

/** Compact insight readout for the dashboard pulse. */
export function insightsPulse(snapshot: InsightSnapshot): InsightsPulse {
  let newIdeas = 0;
  let improvements = 0;
  let unsaved = 0;

  for (const insight of snapshot.insights) {
    if (insight.type === "new_idea") newIdeas += 1;
    else improvements += 1;
    if (!insight.savedAsIdea) unsaved += 1;
  }

  return {
    total: snapshot.insights.length,
    newIdeas,
    improvements,
    unsaved,
    lastGeneratedAt: snapshot.generation?.generatedAt ?? null,
  };
}

/** Newest first by an ISO timestamp field, then cap the list. */
export function takeRecent<T>(items: T[], timestamp: (item: T) => string, limit = 5): T[] {
  return [...items]
    .sort((a, b) => timestamp(b).localeCompare(timestamp(a)))
    .slice(0, limit);
}
