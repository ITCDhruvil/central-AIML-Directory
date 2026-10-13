import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_AI_SETTINGS,
  decideQuota,
  effectiveLimits,
  isFeatureOn,
  parseAiSettings,
  sanitizeAiSettings,
  usageWindows,
} from "@/lib/aiSettings";

test("defaults leave AI on and unlimited, so nothing changes until an admin sets limits", () => {
  assert.equal(DEFAULT_AI_SETTINGS.enabled, true);
  assert.equal(isFeatureOn(DEFAULT_AI_SETTINGS, "ai_chatbot"), true);
  assert.deepEqual(effectiveLimits(DEFAULT_AI_SETTINGS, null), { dailyRequests: null, monthlyTokens: null });
});

test("kill switch turns every feature off", () => {
  const s = { ...DEFAULT_AI_SETTINGS, enabled: false };
  assert.equal(isFeatureOn(s, "ai_chatbot"), false);
  assert.equal(isFeatureOn(s, "ai_insights"), false);
});

test("a single feature can be switched off", () => {
  const s = { ...DEFAULT_AI_SETTINGS, features: { ai_text_transform: false } };
  assert.equal(isFeatureOn(s, "ai_text_transform"), false);
  assert.equal(isFeatureOn(s, "ai_chatbot"), true);
});

test("sanitize: accepts a valid object and rejects unknown features or bad numbers", () => {
  const ok = sanitizeAiSettings({ enabled: false, features: { ai_chatbot: false }, defaultDailyRequests: 50 });
  assert.ok(ok.ok);
  assert.equal(ok.settings.defaultDailyRequests, 50);
  assert.equal(sanitizeAiSettings({ features: { not_a_feature: true } }).ok, false);
  assert.equal(sanitizeAiSettings({ defaultDailyRequests: -1 }).ok, false);
  assert.equal(sanitizeAiSettings({ defaultMonthlyTokens: 1.5 }).ok, false);
  assert.equal(sanitizeAiSettings({ enabled: "no" }).ok, false);
  assert.equal(sanitizeAiSettings(null).ok, false);
});

test("parse: broken storage never switches AI off", () => {
  assert.equal(parseAiSettings("garbage").enabled, true);
  assert.equal(parseAiSettings(JSON.stringify({ enabled: "nope" })).enabled, true);
  assert.equal(parseAiSettings(null).enabled, true);
});

test("effectiveLimits: own override wins, null inherits, 0 means unlimited", () => {
  const s = { ...DEFAULT_AI_SETTINGS, defaultDailyRequests: 20, defaultMonthlyTokens: 1000 };
  assert.deepEqual(effectiveLimits(s, null), { dailyRequests: 20, monthlyTokens: 1000 });
  assert.deepEqual(effectiveLimits(s, { dailyRequests: 5, monthlyTokens: null }), { dailyRequests: 5, monthlyTokens: 1000 });
  assert.deepEqual(effectiveLimits(s, { dailyRequests: 0, monthlyTokens: 0 }), { dailyRequests: null, monthlyTokens: null });
});

test("decideQuota: allows under the limits and blocks at them", () => {
  const limits = { dailyRequests: 3, monthlyTokens: 100 };
  assert.deepEqual(decideQuota(limits, { requestsToday: 2, tokensThisMonth: 99 }), { allowed: true });
  const daily = decideQuota(limits, { requestsToday: 3, tokensThisMonth: 0 });
  assert.equal(daily.allowed, false);
  assert.equal(!daily.allowed && daily.reason, "daily");
  const monthly = decideQuota(limits, { requestsToday: 0, tokensThisMonth: 100 });
  assert.equal(!monthly.allowed && monthly.reason, "monthly");
});

test("decideQuota: unlimited never blocks", () => {
  assert.deepEqual(decideQuota({ dailyRequests: null, monthlyTokens: null }, { requestsToday: 1e6, tokensThisMonth: 1e9 }), { allowed: true });
});

test("usageWindows: UTC day and month starts", () => {
  const w = usageWindows(new Date("2026-10-12T15:30:00Z"));
  assert.equal(w.dayStart.toISOString(), "2026-10-12T00:00:00.000Z");
  assert.equal(w.monthStart.toISOString(), "2026-10-01T00:00:00.000Z");
});
