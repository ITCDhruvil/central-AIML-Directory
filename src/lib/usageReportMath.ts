// Pure helpers for the AI usage report, so the bucketing can be tested without a database.

export type UsageRow = { createdAt: Date; status: string; inputTokens: number; outputTokens: number };

export type DayBucket = { date: string; requests: number; tokens: number; blocked: number };

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/**
 * One bucket per UTC day for the last `days` days, oldest first, including days with no activity so a chart has no gaps.
 * Requests are calls that reached the model (OK or ERROR); blocked attempts are counted separately.
 */
export function bucketByDay(rows: UsageRow[], days: number, now: Date = new Date()): DayBucket[] {
  const buckets = new Map<string, DayBucket>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    const key = dayKey(d);
    buckets.set(key, { date: key, requests: 0, tokens: 0, blocked: 0 });
  }
  for (const row of rows) {
    const bucket = buckets.get(dayKey(row.createdAt));
    if (!bucket) continue;
    if (row.status === "OK" || row.status === "ERROR") {
      bucket.requests += 1;
      bucket.tokens += row.inputTokens + row.outputTokens;
    } else {
      bucket.blocked += 1;
    }
  }
  return [...buckets.values()];
}
