import "server-only";
import { prisma } from "@/lib/prisma";
import { bucketByDay, type DayBucket } from "@/lib/usageReportMath";

export type FeatureUsage = { feature: string; requests: number; tokens: number; blocked: number };
export type UserUsage = { userId: string; name: string; email: string; requests: number; tokens: number; blocked: number };
export type RecentUsage = {
  id: string;
  createdAt: string;
  userName: string;
  feature: string;
  model: string | null;
  tokens: number;
  status: string;
};

export type UsageReport = {
  days: number;
  totals: { requests: number; tokens: number; blocked: number; errors: number };
  daily: DayBucket[];
  byFeature: FeatureUsage[];
  topUsers: UserUsage[];
  recent: RecentUsage[];
};

/** Usage over the last `days` UTC days (including today), for the admin AI page. */
export async function getUsageReport(days: number): Promise<UsageReport> {
  const now = new Date();
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)));
  const rows = await prisma.aiUsageLog.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, email: true } } },
    take: 20_000, // a hard ceiling so a very busy workspace can't make this page heavy
  });

  const byFeature = new Map<string, FeatureUsage>();
  const byUser = new Map<string, UserUsage>();
  const totals = { requests: 0, tokens: 0, blocked: 0, errors: 0 };

  for (const r of rows) {
    const reached = r.status === "OK" || r.status === "ERROR";
    const tokens = reached ? r.inputTokens + r.outputTokens : 0;
    if (reached) {
      totals.requests += 1;
      totals.tokens += tokens;
      if (r.status === "ERROR") totals.errors += 1;
    } else {
      totals.blocked += 1;
    }

    const f = byFeature.get(r.feature) ?? { feature: r.feature, requests: 0, tokens: 0, blocked: 0 };
    const u = byUser.get(r.userId) ?? { userId: r.userId, name: r.user.name, email: r.user.email, requests: 0, tokens: 0, blocked: 0 };
    for (const bucket of [f, u]) {
      if (reached) {
        bucket.requests += 1;
        bucket.tokens += tokens;
      } else {
        bucket.blocked += 1;
      }
    }
    byFeature.set(r.feature, f);
    byUser.set(r.userId, u);
  }

  return {
    days,
    totals,
    daily: bucketByDay(rows, days, now),
    byFeature: [...byFeature.values()].sort((a, b) => b.requests - a.requests),
    topUsers: [...byUser.values()].sort((a, b) => b.tokens - a.tokens || b.requests - a.requests).slice(0, 10),
    recent: rows.slice(0, 50).map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      userName: r.user.name,
      feature: r.feature,
      model: r.model,
      tokens: r.inputTokens + r.outputTokens,
      status: r.status,
    })),
  };
}
