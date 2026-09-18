import "server-only";
import type { ToolDefinition } from "@/lib/ai/chatTypes";
import { searchWeb } from "@/lib/websearch/langsearch";

export const INSIGHTS_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Searches the live web. Use this to find current tools, libraries, or trends relevant to a project's tech stack or domain before suggesting anything as \"new\" or \"trending\".",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "A focused search query, e.g. \"best vector database 2026\" or \"trends in construction computer vision 2026\"" } },
        required: ["query"],
      },
    },
  },
];

export const INSIGHTS_TOOL_HANDLERS: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
  web_search: async (args) => {
    const query = typeof args.query === "string" ? args.query.trim() : "";
    if (!query) return { error: "query is required" };
    try {
      const results = await searchWeb(query);
      return { results };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Web search failed" };
    }
  },
};
