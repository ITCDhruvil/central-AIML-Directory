/** How many previous passwords (besides the current one) a user may not go back to. */
export const PASSWORD_HISTORY_LIMIT = 5;

export const PASSWORD_REUSED_MESSAGE = "You've used this password before. Choose a different one.";

/**
 * True when `candidate` matches any of the given hashes. Pure so it can be tested without bcrypt or a database:
 * the caller supplies the hash comparison.
 */
export async function matchesAnyHash(
  candidate: string,
  hashes: readonly string[],
  verify: (password: string, hash: string) => Promise<boolean>,
): Promise<boolean> {
  for (const hash of hashes) {
    if (await verify(candidate, hash)) return true;
  }
  return false;
}
