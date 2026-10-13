import "server-only";
import { prisma } from "@/lib/prisma";
import { DEFAULT_EMAIL_DOMAIN, normalizeEmailDomain } from "@/lib/emailDomain";

const KEY = "auth.emailDomain";

/** The company email domain everyone signs in with (an admin can change it in Settings). Defaults to itcube.net. */
export async function getEmailDomain(): Promise<string> {
  const row = await prisma.appSetting.findUnique({ where: { key: KEY } });
  if (!row) return DEFAULT_EMAIL_DOMAIN;
  try {
    return normalizeEmailDomain(JSON.parse(row.value)) ?? DEFAULT_EMAIL_DOMAIN;
  } catch {
    return DEFAULT_EMAIL_DOMAIN;
  }
}

export async function setEmailDomain(domain: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: JSON.stringify(domain) },
    update: { value: JSON.stringify(domain) },
  });
}

/** Active accounts whose email isn't on the domain — they couldn't sign in with just a username after a change. */
export async function countAccountsOutsideDomain(domain: string): Promise<number> {
  return prisma.user.count({
    where: { active: true, NOT: { email: { endsWith: `@${domain}`, mode: "insensitive" } } },
  });
}
