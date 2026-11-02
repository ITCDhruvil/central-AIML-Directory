import "server-only";
import { prisma } from "@/lib/prisma";
import { nameKey, type PeopleDirectory } from "@/types/people";

// Read for every page (it feeds the layout), so keep it in memory briefly like the other app-wide settings. Setting or
// removing a picture calls invalidatePeopleDirectory(), so a change shows up at once on this instance and within the TTL
// on any other.
const TTL_MS = 15_000;

let cached: { directory: PeopleDirectory; expires: number } | null = null;

export function invalidatePeopleDirectory(): void {
  cached = null;
}

export async function getPeopleDirectory(): Promise<PeopleDirectory> {
  if (cached && cached.expires > Date.now()) return cached.directory;

  // Independent lookups, sent together: one round trip.
  const [avatars, users, owners] = await Promise.all([
    prisma.userAvatar.findMany({ select: { userId: true, updatedAt: true } }),
    prisma.user.findMany({ select: { id: true, name: true } }),
    prisma.owner.findMany({ where: { userId: { not: null } }, select: { name: true, userId: true } }),
  ]);

  const versions: Record<string, number> = {};
  for (const a of avatars) versions[a.userId] = a.updatedAt.getTime();

  // Every name that points at a person with a picture. A name claimed by two different people is dropped: showing the
  // wrong person's face is worse than showing initials.
  const claims = new Map<string, Set<string>>();
  const claim = (name: string, userId: string) => {
    if (!(userId in versions)) return;
    const key = nameKey(name);
    if (!key) return;
    claims.set(key, (claims.get(key) ?? new Set()).add(userId));
  };
  for (const u of users) claim(u.name, u.id);
  for (const o of owners) if (o.userId) claim(o.name, o.userId);
  // A user name that someone without a picture also uses is just as ambiguous.
  const holders = new Map<string, number>();
  for (const u of users) holders.set(nameKey(u.name), (holders.get(nameKey(u.name)) ?? 0) + 1);

  const idByName: Record<string, string> = {};
  for (const [key, ids] of claims) {
    if (ids.size === 1 && (holders.get(key) ?? 0) <= 1) idByName[key] = [...ids][0];
  }

  const directory: PeopleDirectory = { versions, idByName };
  cached = { directory, expires: Date.now() + TTL_MS };
  return directory;
}
