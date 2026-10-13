import "server-only";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { matchesAnyHash } from "@/lib/auth/passwordReuse";

/** True when `candidate` is the user's current password or one of their last `historyCount` (0 = current only). */
export async function isPasswordReused(
  userId: string,
  currentHash: string,
  candidate: string,
  historyCount: number,
): Promise<boolean> {
  const past =
    historyCount > 0
      ? await prisma.passwordHistory.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: historyCount,
          select: { hash: true },
        })
      : [];
  return matchesAnyHash(candidate, [currentHash, ...past.map((p) => p.hash)], verifyPassword);
}

/**
 * Prisma operation that remembers a hash that is about to be replaced. Run it in the same transaction as the update,
 * so the old password is recorded exactly when it stops being current.
 */
export function rememberPasswordHash(userId: string, hash: string) {
  return prisma.passwordHistory.create({ data: { userId, hash } });
}
