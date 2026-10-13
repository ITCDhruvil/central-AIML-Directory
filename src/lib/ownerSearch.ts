/** Person-name matching for owners: "Devika" finds "Devika S Vinod". */

export function tokenizePersonQuery(query: string): string[] {
  return query.trim().split(/\s+/).filter(Boolean);
}

/** True when every query token appears in the owner name (substring or name-part prefix). */
export function ownerNameMatches(ownerName: string, query: string): boolean {
  const owner = ownerName.trim().toLowerCase();
  const tokens = tokenizePersonQuery(query).map((t) => t.toLowerCase());
  if (!owner || tokens.length === 0) return false;
  const parts = owner.split(/\s+/);
  return tokens.every((token) => owner.includes(token) || parts.some((part) => part.startsWith(token)));
}

/** Prisma `where` fragment: case-insensitive token match on the owner column. */
export function ownerPrismaClause(query: string): Record<string, unknown> | null {
  const tokens = tokenizePersonQuery(query);
  if (tokens.length === 0) return null;
  if (tokens.length === 1) {
    return { owner: { contains: tokens[0], mode: "insensitive" } };
  }
  return {
    AND: tokens.map((token) => ({ owner: { contains: token, mode: "insensitive" } })),
  };
}
