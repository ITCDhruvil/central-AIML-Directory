import type { Suggestion } from "@/lib/ai/insightsValidator";
import type { IdeaInput } from "@/types/idea";

type SuggestionFields = Pick<
  Suggestion,
  "type" | "title" | "reasoning" | "suggestedTool" | "relatedProjectName" | "sourceUrls"
>;

/** Turns a generated suggestion into the payload for POST /api/ideas — shared by the global Insights page and the per-project panel so "Save as Idea" behaves identically everywhere. */
export function suggestionToIdeaInput(suggestion: SuggestionFields): IdeaInput {
  const parts = [suggestion.reasoning];
  if (suggestion.suggestedTool) parts.push(`**Suggested tool:** ${suggestion.suggestedTool}`);
  if (suggestion.relatedProjectName) parts.push(`**Relates to:** ${suggestion.relatedProjectName}`);
  if (suggestion.sourceUrls.length > 0) {
    parts.push(`**Sources:**\n${suggestion.sourceUrls.map((u) => `- ${u}`).join("\n")}`);
  }

  return {
    name: suggestion.title,
    status: "ACTIVE",
    description: parts.join("\n\n"),
    tags: ["ai-suggested", suggestion.type === "improvement" ? "improvement" : "new-idea"],
    technologies: suggestion.suggestedTool ? [{ name: suggestion.suggestedTool, category: "OTHER", evidence: ["ai-suggested"], confidence: "MEDIUM" }] : [],
  };
}
