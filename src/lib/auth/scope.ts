// Pure data-scope helpers: turn "what this user may see" into Prisma `where` fragments.
// "Own" = the item's free-text owner equals a name linked to the user, or it was shared with them.

export type AccessScope =
  | { all: true }
  | { all: false; ownerNames: string[]; sharedProjectIds: string[]; sharedIdeaIds: string[] };

export const ALL_ACCESS: AccessScope = { all: true };
export const NO_ACCESS: AccessScope = { all: false, ownerNames: [], sharedProjectIds: [], sharedIdeaIds: [] };

type Where = Record<string, unknown>;

export function normalizeOwnerNames(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

function ownedWhere(ownerNames: string[], sharedIds: string[]): Where {
  const clauses: Where[] = ownerNames.map((name) => ({ owner: { equals: name, mode: "insensitive" } }));
  if (sharedIds.length > 0) clauses.push({ id: { in: sharedIds } });
  if (clauses.length === 0) return { id: { in: [] } };
  return clauses.length === 1 ? clauses[0] : { OR: clauses };
}

export function projectScopeWhere(access: AccessScope): Where {
  return access.all ? {} : ownedWhere(access.ownerNames, access.sharedProjectIds);
}

export function ideaScopeWhere(access: AccessScope): Where {
  return access.all ? {} : ownedWhere(access.ownerNames, access.sharedIdeaIds);
}

/** AND-combines where fragments, skipping empty ones. */
export function andWhere(...parts: Where[]): Where {
  const real = parts.filter((p) => Object.keys(p).length > 0);
  if (real.length === 0) return {};
  if (real.length === 1) return real[0];
  return { AND: real };
}
