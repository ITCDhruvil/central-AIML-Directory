export const INSIGHT_TYPES = ["new_idea", "improvement"] as const;
export type InsightType = (typeof INSIGHT_TYPES)[number];

export const INSIGHT_CHANGES = ["added", "updated", "unchanged"] as const;
export type InsightChange = (typeof INSIGHT_CHANGES)[number];

export interface Insight {
  id: string;
  scope: string;
  type: InsightType;
  title: string;
  reasoning: string;
  suggestedTool: string | null;
  relatedProjectName: string | null;
  sourceUrls: string[];
  savedAsIdea: boolean;
  lastChange: InsightChange | null;
  firstGeneratedAt: string;
  lastGeneratedAt: string;
}

export interface InsightGeneration {
  id: string;
  scope: string;
  generatedAt: string;
  addedCount: number;
  updatedCount: number;
  unchangedCount: number;
  addedTitles: string[];
  updatedTitles: string[];
}

export interface InsightSnapshot {
  insights: Insight[];
  generation: InsightGeneration | null;
}
