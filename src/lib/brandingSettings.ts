import "server-only";
import { prisma } from "@/lib/prisma";
import { DEFAULT_BRANDING, parseBranding, type Branding } from "@/lib/branding";

const KEY = "general.branding";
// Read for every page, so keep it in memory briefly.
const TTL_MS = 15_000;

let cached: { branding: Branding; expires: number } | null = null;

export async function getBranding(): Promise<Branding> {
  if (cached && cached.expires > Date.now()) return cached.branding;
  let branding = { ...DEFAULT_BRANDING };
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: KEY } });
    branding = parseBranding(row?.value);
  } catch (error) {
    // The sign-in page must still render if settings can't be read.
    console.error("getBranding failed; using defaults", error);
  }
  cached = { branding, expires: Date.now() + TTL_MS };
  return branding;
}

export async function setBranding(branding: Branding): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: JSON.stringify(branding) },
    update: { value: JSON.stringify(branding) },
  });
  cached = { branding, expires: Date.now() + TTL_MS };
}
