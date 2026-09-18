import type { Insight as InsightRow, InsightGeneration as InsightGenerationRow } from "@/generated/prisma/client";
import { parseStringArray } from "@/lib/projectMapper";
import { INSIGHT_CHANGES, INSIGHT_TYPES, type Insight, type InsightChange, type InsightGeneration } from "@/types/insight";
import type { InsightMergeRecord } from "@/lib/insightMerge";

function toInsightChange(value: string | null): InsightChange | null {
  return INSIGHT_CHANGES.includes(value as InsightChange) ? (value as InsightChange) : null;
}

export function toInsight(row: InsightRow): Insight {
  const type = INSIGHT_TYPES.includes(row.type as Insight["type"]) ? (row.type as Insight["type"]) : "new_idea";
  return {
    id: row.id,
    scope: row.scope,
    type,
    title: row.title,
    reasoning: row.reasoning,
    suggestedTool: row.suggestedTool,
    relatedProjectName: row.relatedProjectName,
    sourceUrls: parseStringArray(row.sourceUrls),
    savedAsIdea: row.savedAsIdea,
    lastChange: toInsightChange(row.lastChange),
    firstGeneratedAt: row.firstGeneratedAt.toISOString(),
    lastGeneratedAt: row.lastGeneratedAt.toISOString(),
  };
}

export function toInsightMergeRecord(row: InsightRow): InsightMergeRecord {
  const insight = toInsight(row);
  return {
    id: row.id,
    fingerprint: row.fingerprint,
    type: insight.type,
    title: insight.title,
    reasoning: insight.reasoning,
    suggestedTool: insight.suggestedTool,
    relatedProjectName: insight.relatedProjectName,
    sourceUrls: insight.sourceUrls,
  };
}

export function toInsightGeneration(row: InsightGenerationRow): InsightGeneration {
  return {
    id: row.id,
    scope: row.scope,
    generatedAt: row.generatedAt.toISOString(),
    addedCount: row.addedCount,
    updatedCount: row.updatedCount,
    unchangedCount: row.unchangedCount,
    addedTitles: parseStringArray(row.addedTitles),
    updatedTitles: parseStringArray(row.updatedTitles),
  };
}
