/** Default wait before a signed-in user's reset request is answered automatically (the security policy can change it). */
export const DEFAULT_AUTO_ISSUE_MINUTES = 10;

/**
 * When the temporary password will be issued for a request made at `createdAt`, or null when automatic issuing is off
 * (`minutes` is 0) and the request waits for an administrator.
 */
export function autoIssueAt(createdAt: Date, minutes: number): Date | null {
  if (minutes <= 0) return null;
  return new Date(createdAt.getTime() + minutes * 60_000);
}

/** True once the administrator's window has passed. Never true when automatic issuing is off. */
export function autoIssueDue(createdAt: Date, minutes: number, now: Date = new Date()): boolean {
  const at = autoIssueAt(createdAt, minutes);
  return at !== null && now.getTime() >= at.getTime();
}
