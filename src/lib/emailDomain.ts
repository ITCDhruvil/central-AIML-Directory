// Pure helpers for the sign-in email domain. Everyone signs in with a username at one company domain, so the
// login form shows the domain as a fixed suffix and people only type the part before the @.

export const DEFAULT_EMAIL_DOMAIN = "itcube.net";

const DOMAIN_RE = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const LOCAL_RE = /^[a-z0-9._%+-]+$/;

/** "@ITCube.net " → "itcube.net". Returns null for anything that isn't a plausible domain. */
export function normalizeEmailDomain(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const domain = raw.trim().replace(/^@+/, "").toLowerCase();
  return DOMAIN_RE.test(domain) && !domain.split(".").some((part) => part.startsWith("-") || part.endsWith("-")) ? domain : null;
}

/**
 * Turns what someone typed in the username box into the account email. A bare username gets the domain added.
 * A full address is only accepted if it already uses the domain, so nobody can sign in under another one.
 */
export function usernameToEmail(input: string, domain: string): { ok: true; email: string } | { ok: false; error: string } {
  const value = input.trim().toLowerCase();
  if (!value) return { ok: false, error: "Enter your username." };

  let local = value;
  if (value.includes("@")) {
    const at = value.lastIndexOf("@");
    local = value.slice(0, at);
    if (value.slice(at + 1) !== domain.toLowerCase()) {
      return { ok: false, error: `Sign in with your @${domain} username.` };
    }
  }
  if (!LOCAL_RE.test(local)) return { ok: false, error: "That username doesn't look right. Use letters, numbers and dots." };
  return { ok: true, email: `${local}@${domain.toLowerCase()}` };
}

export function emailMatchesDomain(email: string, domain: string): boolean {
  const at = email.lastIndexOf("@");
  return at > 0 && email.slice(at + 1).toLowerCase() === domain.toLowerCase();
}
