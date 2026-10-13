import "server-only";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SECURITY_POLICY, parsePolicy, type SecurityPolicy } from "@/lib/securityPolicy";

const KEY = "security.policy";
// Read on every sign-in and password change, so keep it in memory briefly. A change made here shows up immediately on
// this instance and within the TTL on any other.
const TTL_MS = 15_000;

let cached: { policy: SecurityPolicy; expires: number } | null = null;

export async function getSecurityPolicy(): Promise<SecurityPolicy> {
  if (cached && cached.expires > Date.now()) return cached.policy;
  let policy = { ...DEFAULT_SECURITY_POLICY };
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: KEY } });
    policy = parsePolicy(row?.value);
  } catch (error) {
    // If settings can't be read, fall back to the safe defaults rather than blocking sign-in.
    console.error("getSecurityPolicy failed; using defaults", error);
  }
  cached = { policy, expires: Date.now() + TTL_MS };
  return policy;
}

export async function setSecurityPolicy(policy: SecurityPolicy): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: JSON.stringify(policy) },
    update: { value: JSON.stringify(policy) },
  });
  cached = { policy, expires: Date.now() + TTL_MS };
}
