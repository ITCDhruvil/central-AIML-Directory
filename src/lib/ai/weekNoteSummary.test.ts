import { test } from "node:test";
import assert from "node:assert/strict";
import { writeWeekSummary, buildWeekMessage, WeekSummaryError } from "@/lib/ai/weekNoteSummary";

const config = { apiKey: "k", model: "m", temperature: 0, maxOutputTokens: 100 };
const entries = [
  { day: "2026-11-03", content: "Started the calendar feature." },
  { day: "2026-11-05", content: "Shipped it." },
];

test("builds one section per day", () => {
  const msg = buildWeekMessage(entries);
  assert.match(msg, /## 2026-11-03\nStarted the calendar feature/);
  assert.match(msg, /## 2026-11-05\nShipped it/);
});

test("parses the summary, rejects malformed or empty output", async () => {
  assert.equal(await writeWeekSummary(entries, config, async () => '{"summary":" wk "}'), "wk");
  await assert.rejects(() => writeWeekSummary(entries, config, async () => "x"), WeekSummaryError);
  await assert.rejects(() => writeWeekSummary(entries, config, async () => '{"summary":""}'), WeekSummaryError);
});
