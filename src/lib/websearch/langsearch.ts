import "server-only";

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export class WebSearchError extends Error {}

export function getLangSearchApiKey(): string | null {
  const key = process.env.LANGSEARCH_API_KEY;
  return key && key.trim() ? key : null;
}

/**
 * LangSearch's web search API — plain JSON, no HTML scraping. Only this file
 * knows the request/response shape (POST with a Bearer key, results nested
 * under data.webPages.value); callers (the insights tool handler) only see
 * WebSearchResult[]. Snippet-only mode (no `contents` param) — the insights
 * feature only needs enough text to ground a suggestion, not full pages.
 */
export async function searchWeb(query: string, count = 5): Promise<WebSearchResult[]> {
  const apiKey = getLangSearchApiKey();
  if (!apiKey) {
    throw new WebSearchError("Web search is not configured (missing LANGSEARCH_API_KEY).");
  }

  let response: Response;
  try {
    response = await fetch("https://api.langsearch.com/v1/web-search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, count, freshness: "oneYear" }),
    });
  } catch {
    throw new WebSearchError("Failed to reach the web search provider.");
  }

  if (!response.ok) {
    throw new WebSearchError(`Web search request failed with status ${response.status}`);
  }

  const data = (await response.json()) as {
    data?: { webPages?: { value?: Array<{ name?: unknown; url?: unknown; snippet?: unknown }> } };
  };

  const results = data.data?.webPages?.value;
  if (!Array.isArray(results)) return [];

  return results
    .filter((r): r is { name: string; url: string; snippet: string } => typeof r.name === "string" && typeof r.url === "string" && typeof r.snippet === "string")
    .map((r) => ({ title: r.name, url: r.url, snippet: r.snippet.slice(0, 500) }));
}
