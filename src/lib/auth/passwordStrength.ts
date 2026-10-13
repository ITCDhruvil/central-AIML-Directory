// Pure, browser-safe password helpers (no bcrypt, no node:crypto) so the same rules run in the UI and on the server.

import { DEFAULT_SECURITY_POLICY, type SecurityPolicy } from "@/lib/securityPolicy";

/** The slice of the security policy that decides what an acceptable password looks like. */
export type PasswordPolicy = Pick<SecurityPolicy, "passwordMinLength" | "requireSymbol" | "requireMixedCase">;

export type PasswordRule = { id: "length" | "mix" | "case" | "symbol" | "long"; label: string; required: boolean; met: boolean };

export type PasswordStrength = {
  rules: PasswordRule[];
  /** True when every required rule passes — what the server enforces. */
  meetsRequirements: boolean;
  /** 0–4 meter fill. */
  score: 0 | 1 | 2 | 3 | 4;
  label: "Too short" | "Weak" | "Fair" | "Good" | "Strong";
};

export function passwordStrength(password: string, policy: PasswordPolicy = DEFAULT_SECURITY_POLICY): PasswordStrength {
  const min = policy.passwordMinLength;
  const hasMixedCase = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);
  const isLong = password.length >= 12;

  const rules: PasswordRule[] = [
    { id: "length", label: `At least ${min} characters`, required: true, met: password.length >= min },
    { id: "mix", label: "A letter and a number", required: true, met: /[a-zA-Z]/.test(password) && /[0-9]/.test(password) },
    { id: "case", label: "Upper and lower case letters", required: policy.requireMixedCase, met: hasMixedCase },
    { id: "symbol", label: "A symbol (e.g. ! @ # $)", required: policy.requireSymbol, met: hasSymbol },
  ];
  // Once the minimum is 12 or more, a separate "12 or more characters" hint would just repeat the first rule.
  if (min < 12) rules.push({ id: "long", label: "12 or more characters", required: false, met: isLong });

  const meetsRequirements = rules.filter((r) => r.required).every((r) => r.met);
  // The rating counts the same extras whether or not the policy happens to require them, so it stays comparable.
  const extras = [hasMixedCase, hasSymbol, isLong].filter(Boolean).length;

  if (!meetsRequirements) {
    return { rules, meetsRequirements, score: password.length === 0 ? 0 : 1, label: password.length < min ? "Too short" : "Weak" };
  }
  const labels = ["Weak", "Fair", "Good", "Strong"] as const;
  const index = Math.min(extras, 3);
  return { rules, meetsRequirements, score: (index + 1) as 1 | 2 | 3 | 4, label: labels[index] };
}

/** Returns an error message, or null when the password is acceptable. Same rule the server enforces. */
export function validatePasswordStrength(password: string, policy: PasswordPolicy = DEFAULT_SECURITY_POLICY): string | null {
  if (password.length < policy.passwordMinLength) return `Password must be at least ${policy.passwordMinLength} characters.`;
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must include a letter and a number.";
  }
  if (policy.requireMixedCase && !(/[a-z]/.test(password) && /[A-Z]/.test(password))) {
    return "Password must include upper and lower case letters.";
  }
  if (policy.requireSymbol && !/[^a-zA-Z0-9]/.test(password)) return "Password must include a symbol.";
  return null;
}

const LOWER = "abcdefghijkmnpqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%*?-_";

function pick(chars: string): string {
  const buf = new Uint32Array(1);
  // Rejection sampling keeps the choice unbiased.
  const limit = Math.floor(0x100000000 / chars.length) * chars.length;
  do {
    globalThis.crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return chars[buf[0] % chars.length];
}

/** Random password that always contains upper, lower, digit and symbol, so it rates "Strong". */
export function generatePassword(length = 16): string {
  const all = LOWER + UPPER + DIGITS + SYMBOLS;
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < length) chars.push(pick(all));
  // Fisher–Yates shuffle so the guaranteed characters aren't always first.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Number(pickIndex(i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

function pickIndex(n: number): number {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / n) * n;
  do {
    globalThis.crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return buf[0] % n;
}

function slug(part: string): string {
  return part
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** first.last@domain, accent- and punctuation-free. Empty until a first name is typed. */
export function suggestUsername(firstName: string, lastName: string, domain: string): string {
  const first = slug(firstName);
  const last = slug(lastName);
  if (!first) return "";
  return `${last ? `${first}.${last}` : first}@${domain}`;
}
