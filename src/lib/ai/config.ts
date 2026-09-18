import type { AIConfig } from "@/lib/ai/types";

/** Env var name has hyphens (set by the platform team), so it needs bracket access — never rename it in code without checking .env. */
const API_KEY_ENV_VAR = "CENTRAL-AI-PLATFORM_API-KEY";
/** Vercel env names are typically letters, numbers, and underscores — keep this as a deploy-friendly alias. */
const API_KEY_ENV_VAR_VERCEL = "CENTRAL_AI_PLATFORM_API_KEY";

const DEFAULT_MODEL = "gpt-4o-mini";
const TEMPERATURE = 0.1; // low and fixed — factual, citation-grounded answers, not creative ones
const MAX_OUTPUT_TOKENS = 1500; // enough room for a detailed, multi-paragraph import-autofill description alongside the concise Q&A assistant answers

/**
 * Centralized model configuration (provider key, model, temperature, max
 * output tokens) — the only place these are read from the environment.
 * Returns null when the assistant isn't configured (no API key) so callers
 * can surface a clear "not configured" error instead of attempting a doomed
 * network call. Never logs the key. No "server-only" import here (unlike
 * client.ts) so this stays plain-Node testable without a Next.js runtime.
 */
export function getAIConfig(): AIConfig | null {
  const apiKey =
    process.env[API_KEY_ENV_VAR] || process.env[API_KEY_ENV_VAR_VERCEL];
  if (!apiKey || !apiKey.trim()) return null;

  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;

  return { apiKey, model, temperature: TEMPERATURE, maxOutputTokens: MAX_OUTPUT_TOKENS };
}
