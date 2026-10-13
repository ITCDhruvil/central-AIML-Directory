import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { decideQuota, effectiveLimits, isFeatureOn, usageWindows, type AiFeature } from "@/lib/aiSettings";
import { getAiSettings } from "@/lib/ai/aiSettingsStore";
import { runWithUsage } from "@/lib/ai/usageContext";

export type UsageStatus = "OK" | "BLOCKED_QUOTA" | "BLOCKED_PERMISSION" | "ERROR";

async function logUsage(entry: {
  userId: string;
  feature: string;
  status: UsageStatus;
  model?: string | null;
  inputTokens?: number;
  outputTokens?: number;
}): Promise<void> {
  try {
    await prisma.aiUsageLog.create({
      data: {
        userId: entry.userId,
        feature: entry.feature,
        status: entry.status,
        model: entry.model ?? null,
        inputTokens: entry.inputTokens ?? 0,
        outputTokens: entry.outputTokens ?? 0,
      },
    });
  } catch (error) {
    // Logging must never break the request it describes.
    console.error("aiUsageLog write failed", error);
  }
}

/** Requests made today and tokens used this month (UTC), counting only calls that reached the model. */
async function currentUsage(userId: string): Promise<{ requestsToday: number; tokensThisMonth: number }> {
  const { dayStart, monthStart } = usageWindows();
  const [requestsToday, month] = await Promise.all([
    prisma.aiUsageLog.count({ where: { userId, createdAt: { gte: dayStart }, status: { in: ["OK", "ERROR"] } } }),
    prisma.aiUsageLog.aggregate({
      where: { userId, createdAt: { gte: monthStart }, status: { in: ["OK", "ERROR"] } },
      _sum: { inputTokens: true, outputTokens: true },
    }),
  ]);
  return { requestsToday, tokensThisMonth: (month._sum.inputTokens ?? 0) + (month._sum.outputTokens ?? 0) };
}

type Handler<Ctx> = (request: NextRequest, ctx: Ctx) => Promise<Response>;

/**
 * Wraps an AI route. Before it runs: the master switch, the per-feature switch and the person's quota. While it runs:
 * the model client reports token use. After: one row in the usage log. Signed-out or unpermitted callers pass straight
 * through, so the route's own 401/403 still applies, and a request that never reached the model (a validation error,
 * say) is not logged or counted.
 */
export function guardedAi<Ctx>(feature: AiFeature, handler: Handler<Ctx>): Handler<Ctx> {
  return async (request, ctx) => {
    const user = await getCurrentUser();
    if (!user || user.mustChangePassword || !can(user.permissions, feature, "use")) return handler(request, ctx);

    const settings = await getAiSettings();
    if (!isFeatureOn(settings, feature)) {
      await logUsage({ userId: user.id, feature, status: "BLOCKED_PERMISSION" });
      return NextResponse.json(
        {
          error: settings.enabled
            ? "This AI feature has been turned off by an administrator."
            : "AI features have been turned off by an administrator.",
        },
        { status: 503 },
      );
    }

    const override = await prisma.aiQuota.findUnique({
      where: { userId: user.id },
      select: { dailyRequests: true, monthlyTokens: true },
    });
    const limits = effectiveLimits(settings, override);
    if (limits.dailyRequests !== null || limits.monthlyTokens !== null) {
      const decision = decideQuota(limits, await currentUsage(user.id));
      if (!decision.allowed) {
        await logUsage({ userId: user.id, feature, status: "BLOCKED_QUOTA" });
        return NextResponse.json({ error: decision.message }, { status: 429 });
      }
    }

    const { result: response, tally } = await runWithUsage(() => handler(request, ctx));
    if (tally.calls > 0 || response.status >= 500) {
      await logUsage({
        userId: user.id,
        feature,
        status: response.ok ? "OK" : "ERROR",
        model: tally.model,
        inputTokens: tally.inputTokens,
        outputTokens: tally.outputTokens,
      });
    }
    return response;
  };
}
