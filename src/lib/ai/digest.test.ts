import { test } from "node:test";
import assert from "node:assert/strict";
import { writeDigest, buildDigestUserMessage, DigestError } from "@/lib/ai/digest";

const config = { apiKey: "k", model: "m", temperature: 0, maxOutputTokens: 100 };
const events = [
  { id: "1", projectId: "p", type: "PROJECT_CREATED" as const, title: "Created SPARK", createdAt: "2026-11-01T10:00:00.000Z", projectName: "SPARK" },
];

test("lists events with project name and date", () => {
  const msg = buildDigestUserMessage(events, 7);
  assert.match(msg, /\[SPARK\] Created SPARK \(2026-11-01\)/);
  assert.match(msg, /last 7 days/);
});

test("parses the summary, rejects malformed or empty output", async () => {
  assert.equal(await writeDigest(events, 7, config, async () => '{"summary":" update "}'), "update");
  await assert.rejects(() => writeDigest(events, 7, config, async () => "nope"), DigestError);
  await assert.rejects(() => writeDigest(events, 7, config, async () => '{"summary":""}'), DigestError);
});
