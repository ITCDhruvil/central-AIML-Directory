// Browser-safe (no server imports): the same shape and rules are used by the settings form and by the server.

export type SecurityPolicy = {
  /** Shortest allowed password. */
  passwordMinLength: number;
  /** Require a symbol, on top of a letter and a number. */
  requireSymbol: boolean;
  /** Require both upper and lower case letters. */
  requireMixedCase: boolean;
  /** How many previous passwords can't be reused (besides the current one). 0 = only the current one is blocked. */
  passwordHistoryCount: number;
  /** Minutes before a signed-in person's reset request is answered automatically. 0 = never; wait for an administrator. */
  resetAutoIssueMinutes: number;
  /** How long a sign-in lasts without "remember me". */
  sessionHours: number;
  /** How long a sign-in lasts with "remember me". */
  rememberDays: number;
  /** Failed sign-ins per account before it is locked for the window. */
  loginMaxFailures: number;
  /** How long a lock lasts, in minutes. */
  loginWindowMinutes: number;
};

export const DEFAULT_SECURITY_POLICY: SecurityPolicy = {
  passwordMinLength: 8,
  requireSymbol: false,
  requireMixedCase: false,
  passwordHistoryCount: 5,
  resetAutoIssueMinutes: 10,
  sessionHours: 12,
  rememberDays: 7,
  loginMaxFailures: 8,
  loginWindowMinutes: 15,
};

type NumberField = {
  key: keyof SecurityPolicy;
  label: string;
  min: number;
  max: number;
};

/** Allowed ranges. The floors matter: nobody can configure a policy weaker than a basic safe minimum. */
export const POLICY_RANGES: NumberField[] = [
  {
    key: "passwordMinLength",
    label: "Minimum password length",
    min: 8,
    max: 64,
  },
  {
    key: "passwordHistoryCount",
    label: "Previous passwords blocked",
    min: 0,
    max: 12,
  },
  { key: "resetAutoIssueMinutes", label: "Auto-issue wait", min: 0, max: 240 },
  { key: "sessionHours", label: "Session length", min: 1, max: 72 },
  { key: "rememberDays", label: "Remember-me length", min: 1, max: 90 },
  {
    key: "loginMaxFailures",
    label: "Failed sign-ins before lock",
    min: 3,
    max: 50,
  },
  { key: "loginWindowMinutes", label: "Lock duration", min: 1, max: 240 },
];

const BOOLEAN_KEYS: (keyof SecurityPolicy)[] = [
  "requireSymbol",
  "requireMixedCase",
];

export type PolicyResult =
  { ok: true; policy: SecurityPolicy } | { ok: false; error: string };

/**
 * Validates a submitted policy. Missing fields fall back to the defaults, so a partial object is fine; anything present
 * must be a whole number in range (or a boolean).
 */
export function sanitizePolicy(raw: unknown): PolicyResult {
  if (typeof raw !== "object" || raw === null)
    return { ok: false, error: "Invalid settings." };
  const input = raw as Record<string, unknown>;
  const policy: SecurityPolicy = { ...DEFAULT_SECURITY_POLICY };

  for (const field of POLICY_RANGES) {
    const value = input[field.key];
    if (value === undefined) continue;
    if (
      typeof value !== "number" ||
      !Number.isInteger(value) ||
      value < field.min ||
      value > field.max
    ) {
      return {
        ok: false,
        error: `${field.label} must be a whole number from ${field.min} to ${field.max}.`,
      };
    }
    (policy[field.key] as number) = value;
  }
  for (const key of BOOLEAN_KEYS) {
    const value = input[key];
    if (value === undefined) continue;
    if (typeof value !== "boolean")
      return { ok: false, error: "Invalid settings." };
    (policy[key] as boolean) = value;
  }
  return { ok: true, policy };
}

/** Reads a stored policy, ignoring anything invalid so a bad row can never break sign-in. */
export function parsePolicy(stored: string | null | undefined): SecurityPolicy {
  if (!stored) return { ...DEFAULT_SECURITY_POLICY };
  try {
    const parsed = JSON.parse(stored) as Record<string, unknown>;
    // Keep every valid field; drop invalid ones individually rather than discarding the whole row.
    const valid: Record<string, unknown> = {};
    for (const field of POLICY_RANGES) {
      if (sanitizePolicy({ [field.key]: parsed[field.key] }).ok)
        valid[field.key] = parsed[field.key];
    }
    for (const key of BOOLEAN_KEYS)
      if (typeof parsed[key] === "boolean") valid[key] = parsed[key];
    const result = sanitizePolicy(valid);
    return result.ok ? result.policy : { ...DEFAULT_SECURITY_POLICY };
  } catch {
    return { ...DEFAULT_SECURITY_POLICY };
  }
}

export const sessionSeconds = (policy: SecurityPolicy) =>
  policy.sessionHours * 3600;
export const rememberSeconds = (policy: SecurityPolicy) =>
  policy.rememberDays * 86400;
