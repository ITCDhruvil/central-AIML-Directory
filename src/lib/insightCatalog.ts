import { prisma } from "@/lib/prisma";
import type { Suggestion } from "@/lib/ai/insightsValidator";
import { planInsightMerge, summarizeMerge } from "@/lib/insightMerge";
import { suggestionToIdeaInput } from "@/lib/insightsToIdea";
import { createIdea } from "@/lib/ideas";
import { toInsight, toInsightGeneration, toInsightMergeRecord } from "@/lib/insightMapper";
import type { Insight, InsightSnapshot } from "@/types/insight";

export const CATALOG_INSIGHT_SCOPE = "catalog";

export function insightScope(projectId?: string | null): string {
  const trimmed = projectId?.trim();
  return trimmed ? trimmed : CATALOG_INSIGHT_SCOPE;
}

export class InsightNotFoundError extends Error {}

export async function getInsightSnapshot(scope: string): Promise<InsightSnapshot> {
  const [rows, generation] = await Promise.all([
    prisma.insight.findMany({
      where: { scope },
      orderBy: { firstGeneratedAt: "desc" },
    }),
    prisma.insightGeneration.findFirst({
      where: { scope },
      orderBy: { generatedAt: "desc" },
    }),
  ]);

  return {
    insights: rows.map(toInsight),
    generation: generation ? toInsightGeneration(generation) : null,
  };
}

export async function persistGeneratedInsights(scope: string, incoming: Suggestion[]): Promise<InsightSnapshot> {
  const existingRows = await prisma.insight.findMany({ where: { scope } });
  const plan = planInsightMerge(existingRows.map(toInsightMergeRecord), incoming);
  const summary = summarizeMerge(plan);
  const now = new Date();
  const keepIds = [...plan.update.map((item) => item.existing.id)];

  await prisma.$transaction(async (tx) => {
    for (const item of plan.create) {
      const { suggestion, fingerprint } = item;
      const created = await tx.insight.create({
        data: {
          scope,
          fingerprint,
          type: suggestion.type,
          title: suggestion.title,
          reasoning: suggestion.reasoning,
          suggestedTool: suggestion.suggestedTool,
          relatedProjectName: suggestion.relatedProjectName,
          sourceUrls: JSON.stringify(suggestion.sourceUrls),
          lastChange: "added",
          firstGeneratedAt: now,
          lastGeneratedAt: now,
        },
      });
      keepIds.push(created.id);
    }

    for (const item of plan.update) {
      const { suggestion } = item;
      await tx.insight.update({
        where: { id: item.existing.id },
        data: {
          fingerprint: item.fingerprint,
          title: suggestion.title,
          reasoning: suggestion.reasoning,
          suggestedTool: suggestion.suggestedTool,
          relatedProjectName: suggestion.relatedProjectName,
          sourceUrls: JSON.stringify(suggestion.sourceUrls),
          lastChange: item.changed ? "updated" : "unchanged",
          lastGeneratedAt: now,
        },
      });
    }

    if (keepIds.length === 0) {
      await tx.insight.updateMany({
        where: { scope },
        data: { lastChange: null },
      });
    } else {
      await tx.insight.updateMany({
        where: { scope, id: { notIn: keepIds } },
        data: { lastChange: null },
      });
    }

    await tx.insightGeneration.create({
      data: {
        scope,
        generatedAt: now,
        addedCount: summary.addedCount,
        updatedCount: summary.updatedCount,
        unchangedCount: summary.unchangedCount,
        addedTitles: JSON.stringify(summary.addedTitles),
        updatedTitles: JSON.stringify(summary.updatedTitles),
      },
    });
  });

  return getInsightSnapshot(scope);
}

export async function saveInsightAsIdea(id: string): Promise<Insight> {
  const row = await prisma.insight.findUnique({ where: { id } });
  if (!row) throw new InsightNotFoundError(`Insight ${id} not found`);
  const insight = toInsight(row);
  if (insight.savedAsIdea) return insight;

  await createIdea(suggestionToIdeaInput(insight));
  const updated = await prisma.insight.update({
    where: { id },
    data: { savedAsIdea: true },
  });
  return toInsight(updated);
}
