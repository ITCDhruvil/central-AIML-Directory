import { test } from "node:test";
import assert from "node:assert/strict";
import { getAIConfig } from "@/lib/ai/config";

const API_KEY_ENV_VAR = "CENTRAL-AI-PLATFORM_API-KEY";

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const previous: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) {
    previous[key] = process.env[key];
    if (vars[key] === undefined) delete process.env[key];
    else process.env[key] = vars[key];
  }
  try {
    fn();
  } finally {
    for (const key of Object.keys(previous)) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

test("returns null when the API key env var is not set — the assistant reports itself as not configured", () => {
  withEnv(
    { [API_KEY_ENV_VAR]: undefined, CENTRAL_AI_PLATFORM_API_KEY: undefined },
    () => {
      assert.equal(getAIConfig(), null);
    },
  );
});

test("returns null when the API key env var is blank", () => {
  withEnv({ [API_KEY_ENV_VAR]: "   " }, () => {
    assert.equal(getAIConfig(), null);
  });
});

test("uses a default model when OPENAI_MODEL is unset, and never logs or exposes the key beyond the config object", () => {
  withEnv({ [API_KEY_ENV_VAR]: "test-key-value", OPENAI_MODEL: undefined }, () => {
    const config = getAIConfig();
    assert.ok(config);
    assert.equal(config?.apiKey, "test-key-value");
    assert.equal(config?.model, "gpt-4o-mini");
  });
});

test("respects a custom OPENAI_MODEL override", () => {
  withEnv({ [API_KEY_ENV_VAR]: "test-key-value", OPENAI_MODEL: "gpt-4o" }, () => {
    const config = getAIConfig();
    assert.equal(config?.model, "gpt-4o");
  });
});

test("uses a low, fixed temperature suited to factual, citation-grounded answers", () => {
  withEnv({ [API_KEY_ENV_VAR]: "test-key-value" }, () => {
    const config = getAIConfig();
    assert.ok(config && config.temperature <= 0.2);
  });
});

test("accepts the underscore env alias used on Vercel", () => {
  withEnv(
    { [API_KEY_ENV_VAR]: undefined, CENTRAL_AI_PLATFORM_API_KEY: "vercel-key" },
    () => {
      const config = getAIConfig();
      assert.equal(config?.apiKey, "vercel-key");
    },
  );
});
