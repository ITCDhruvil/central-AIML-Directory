import "server-only";
import { prisma } from "@/lib/prisma";
import { DEFAULT_AI_SETTINGS, parseAiSettings, type AiSettings } from "@/lib/aiSettings";

const KEY = "ai.settings";
// Read on every AI request, so keep it in memory briefly.
const TTL_MS = 10_000;

let cached: { settings: AiSettings; expires: number } | null = null;

export async function getAiSettings(): Promise<AiSettings> {
  if (cached && cached.expires > Date.now()) return cached.settings;
  let settings: AiSettings = { ...DEFAULT_AI_SETTINGS, features: {} };
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: KEY } });
    settings = parseAiSettings(row?.value);
  } catch (error) {
    console.error("getAiSettings failed; using defaults", error);
  }
  cached = { settings, expires: Date.now() + TTL_MS };
  return settings;
}

export async function setAiSettings(settings: AiSettings): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: JSON.stringify(settings) },
    update: { value: JSON.stringify(settings) },
  });
  cached = { settings, expires: Date.now() + TTL_MS };
}
