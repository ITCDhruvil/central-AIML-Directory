// Browser-safe: the same shapes and quota maths are used by the admin form and by the server guard.
import { AI_FEATURES } from "@/lib/auth/permissions";

export type AiFeature = (typeof AI_FEATURES)[number];

export type AiSettings = {
  /** Master kill switch. Off blocks every AI feature for everyone. */
  enabled: boolean;
  /** Per-feature switch, on top of the role/user permission. A missing entry means on. */
  features: Partial<Record<AiFeature, boolean>>;
  /** Default AI requests per person per day. 0 = unlimited. */
  defaultDailyRequests: number;
  /** Default AI tokens per person per month. 0 = unlimited. */
  defaultMonthlyTokens: number;
};

export const DEFAULT_AI_SETTINGS: AiSettings = {
  enabled: true,
  features: {},
  defaultDailyRequests: 0,
  defaultMonthlyTokens: 0,
};

const MAX_DAILY = 100_000;
const MAX_MONTHLY = 1_000_000_000;

export type AiSettingsResult = { ok: true; settings: AiSettings } | { ok: false; error: string };

function isCount(v: unknown, max: number): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max;
}

/** Validates submitted settings. Missing fields keep the defaults. */
export function sanitizeAiSettings(raw: unknown): AiSettingsResult {
  if (typeof raw !== "object" || raw === null) return { ok: false, error: "Invalid settings." };
  const input = raw as Record<string, unknown>;
  const settings: AiSettings = { ...DEFAULT_AI_SETTINGS, features: {} };

  if (input.enabled !== undefined) {
    if (typeof input.enabled !== "boolean") return { ok: false, error: "Invalid settings." };
    settings.enabled = input.enabled;
  }
  if (input.features !== undefined) {
    if (typeof input.features !== "object" || input.features === null) return { ok: false, error: "Invalid settings." };
    const features = input.features as Record<string, unknown>;
    for (const [key, value] of Object.entries(features)) {
      if (!(AI_FEATURES as readonly string[]).includes(key)) return { ok: false, error: `Unknown AI feature: ${key}.` };
      if (typeof value !== "boolean") return { ok: false, error: "Invalid settings." };
      settings.features[key as AiFeature] = value;
    }
  }
  if (input.defaultDailyRequests !== undefined) {
    if (!isCount(input.defaultDailyRequests, MAX_DAILY)) {
      return { ok: false, error: `Daily requests must be a whole number from 0 to ${MAX_DAILY}.` };
    }
    settings.defaultDailyRequests = input.defaultDailyRequests;
  }
  if (input.defaultMonthlyTokens !== undefined) {
    if (!isCount(input.defaultMonthlyTokens, MAX_MONTHLY)) {
      return { ok: false, error: `Monthly tokens must be a whole number from 0 to ${MAX_MONTHLY}.` };
    }
    settings.defaultMonthlyTokens = input.defaultMonthlyTokens;
  }
  return { ok: true, settings };
}

/** Reads stored settings, ignoring anything invalid so a bad row can never switch AI off or break a request. */
export function parseAiSettings(stored: string | null | undefined): AiSettings {
  if (!stored) return { ...DEFAULT_AI_SETTINGS, features: {} };
  try {
    const result = sanitizeAiSettings(JSON.parse(stored));
    return result.ok ? result.settings : { ...DEFAULT_AI_SETTINGS, features: {} };
  } catch {
    return { ...DEFAULT_AI_SETTINGS, features: {} };
  }
}

export function isFeatureOn(settings: AiSettings, feature: string): boolean {
  if (!settings.enabled) return false;
  return settings.features[feature as AiFeature] !== false;
}

/** A person's own limits. null = use the default; 0 = unlimited. */
export type QuotaOverride = { dailyRequests: number | null; monthlyTokens: number | null };

export type Limits = { dailyRequests: number | null; monthlyTokens: number | null };

/** The limits that apply to someone: their own override where set, otherwise the defaults. null means unlimited. */
export function effectiveLimits(settings: AiSettings, override: QuotaOverride | null): Limits {
  const daily = override?.dailyRequests ?? settings.defaultDailyRequests;
  const monthly = override?.monthlyTokens ?? settings.defaultMonthlyTokens;
  return { dailyRequests: daily > 0 ? daily : null, monthlyTokens: monthly > 0 ? monthly : null };
}

export type Usage = { requestsToday: number; tokensThisMonth: number };

export type QuotaDecision = { allowed: true } | { allowed: false; reason: "daily" | "monthly"; message: string };

export function decideQuota(limits: Limits, usage: Usage): QuotaDecision {
  if (limits.dailyRequests !== null && usage.requestsToday >= limits.dailyRequests) {
    return {
      allowed: false,
      reason: "daily",
      message: `You've used your daily limit of ${limits.dailyRequests} AI requests. It resets at midnight UTC.`,
    };
  }
  if (limits.monthlyTokens !== null && usage.tokensThisMonth >= limits.monthlyTokens) {
    return {
      allowed: false,
      reason: "monthly",
      message: "You've used this month's AI allowance. It resets at the start of next month (UTC).",
    };
  }
  return { allowed: true };
}

/** Start of the current UTC day and month, the windows the quotas count over. */
export function usageWindows(now: Date = new Date()): { dayStart: Date; monthStart: Date } {
  return {
    dayStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
    monthStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
  };
}
