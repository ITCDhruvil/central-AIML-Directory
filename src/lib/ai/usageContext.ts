import { AsyncLocalStorage } from "node:async_hooks";

/** What one guarded request spent on the model. Filled in by the model client, read by the guard. */
export type UsageTally = { calls: number; inputTokens: number; outputTokens: number; model: string | null };

const storage = new AsyncLocalStorage<UsageTally>();

/** Runs `fn` and returns its result together with the model usage recorded while it ran. */
export async function runWithUsage<T>(fn: () => Promise<T>): Promise<{ result: T; tally: UsageTally }> {
  const tally: UsageTally = { calls: 0, inputTokens: 0, outputTokens: 0, model: null };
  const result = await storage.run(tally, fn);
  return { result, tally };
}

const count = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : 0);

/** Called by the model client after each provider response. Does nothing outside a guarded request. */
export function recordModelCall(usage: { prompt_tokens?: unknown; completion_tokens?: unknown } | undefined, model: string): void {
  const tally = storage.getStore();
  if (!tally) return;
  tally.calls += 1;
  tally.inputTokens += count(usage?.prompt_tokens);
  tally.outputTokens += count(usage?.completion_tokens);
  tally.model = model;
}
