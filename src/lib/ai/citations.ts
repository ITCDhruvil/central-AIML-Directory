import type { AssistantAnswer, ContextSource } from "@/lib/ai/types";

/**
 * Resolves model-returned citation labels against the server-built source
 * map. Any label the model invented, mistyped, or copied from outside the
 * supplied context is silently discarded — the browser must never see a
 * citation that doesn't correspond to a real supplied document. Order and
 * dedupe by `sources` (not by model output order) so the result is
 * deterministic.
 */
export function resolveCitations(
  citationLabels: string[],
  sources: ContextSource[],
): AssistantAnswer["citations"] {
  const requested = new Set(citationLabels);
  return sources
    .filter((source) => requested.has(source.label))
    .map(({ documentId, title, category }) => ({ documentId, title, category }));
}
