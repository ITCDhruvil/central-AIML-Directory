// Pure validation for the Environments feature (no database), shared by the API and unit tests.

export const ENVIRONMENT_STATUSES = ["LIVE", "DOWN", "NOT_DEPLOYED", "PLANNED", "UNKNOWN"] as const;
export type EnvironmentStatus = (typeof ENVIRONMENT_STATUSES)[number];

export const DEFAULT_ENVIRONMENTS = [
  { name: "DEV", isProduction: false },
  { name: "QA", isProduction: false },
  { name: "UAT", isProduction: false },
  { name: "PROD", isProduction: true },
] as const;

export class EnvironmentError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 = 400,
  ) {
    super(message);
  }
}

const MAX = { name: 60, short: 200, url: 2000, notes: 2000, label: 80, password: 500 };

type Obj = Record<string, unknown>;

export function asObject(raw: unknown): Obj {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new EnvironmentError("Invalid request body");
  return raw as Obj;
}

function text(o: Obj, key: string, max: number, label: string): string | null | undefined {
  if (!(key in o)) return undefined;
  const v = o[key];
  if (v === null) return null;
  if (typeof v !== "string") throw new EnvironmentError(`${label} must be text`);
  const t = v.trim();
  if (t.length > max) throw new EnvironmentError(`${label} must be at most ${max} characters`);
  return t === "" ? null : t;
}

function required(o: Obj, key: string, max: number, label: string, onCreate: boolean): string | undefined {
  const v = text(o, key, max, label);
  if (v === undefined) {
    if (onCreate) throw new EnvironmentError(`${label} is required`);
    return undefined;
  }
  if (v === null) throw new EnvironmentError(`${label} is required`);
  return v;
}

/** Only http(s) URLs are accepted, so javascript: and data: links can never be stored. */
export function validateUrl(value: string, label: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new EnvironmentError(`${label} must be a valid http or https URL`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new EnvironmentError(`${label} must be a valid http or https URL`);
  }
  return value;
}

function urlField(o: Obj, key: string, label: string): string | null | undefined {
  const v = text(o, key, MAX.url, label);
  return typeof v === "string" ? validateUrl(v, label) : v;
}

function dateField(o: Obj, key: string, label: string): Date | null | undefined {
  const v = text(o, key, 40, label);
  if (typeof v !== "string") return v;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new EnvironmentError(`${label} must be a valid date`);
  return d;
}

export type EnvironmentInput = {
  name?: string;
  isProduction?: boolean;
  status?: EnvironmentStatus;
  appUrl?: string | null;
  apiUrl?: string | null;
  healthUrl?: string | null;
  hosting?: string | null;
  databaseSet?: string | null;
  version?: string | null;
  lastDeployedAt?: Date | null;
  notes?: string | null;
};

export function validateEnvironment(raw: unknown, onCreate: boolean): EnvironmentInput {
  const o = asObject(raw);
  const out: EnvironmentInput = {};
  const name = required(o, "name", MAX.name, "Name", onCreate);
  if (name !== undefined) out.name = name;
  if ("isProduction" in o) {
    if (typeof o.isProduction !== "boolean") throw new EnvironmentError("isProduction must be true or false");
    out.isProduction = o.isProduction;
  }
  if ("status" in o) {
    if (!(ENVIRONMENT_STATUSES as readonly unknown[]).includes(o.status)) throw new EnvironmentError("Unknown status");
    out.status = o.status as EnvironmentStatus;
  }
  for (const [key, label] of [
    ["appUrl", "App URL"],
    ["apiUrl", "API URL"],
    ["healthUrl", "Health-check URL"],
  ] as const) {
    const v = urlField(o, key, label);
    if (v !== undefined) out[key] = v;
  }
  for (const [key, label, max] of [
    ["hosting", "Hosting", MAX.short],
    ["databaseSet", "Database set", MAX.short],
    ["version", "Version", MAX.short],
    ["notes", "Notes", MAX.notes],
  ] as const) {
    const v = text(o, key, max, label);
    if (v !== undefined) out[key] = v;
  }
  const deployed = dateField(o, "lastDeployedAt", "Last deployed");
  if (deployed !== undefined) out.lastDeployedAt = deployed;
  return out;
}

export type LinkInput = { label?: string; url?: string; group?: string | null };

export function validateLink(raw: unknown, onCreate: boolean): LinkInput {
  const o = asObject(raw);
  const out: LinkInput = {};
  const label = required(o, "label", MAX.label, "Label", onCreate);
  if (label !== undefined) out.label = label;
  const url = required(o, "url", MAX.url, "URL", onCreate);
  if (url !== undefined) out.url = validateUrl(url, "URL");
  const group = text(o, "group", MAX.label, "Group");
  if (group !== undefined) out.group = group;
  return out;
}

export type CredentialInput = { purpose?: string; username?: string; password?: string | null; notes?: string | null };

/** `password`: a string sets it, null or empty clears it, absent leaves it. Passwords are not trimmed. */
export function validateCredential(raw: unknown, onCreate: boolean): CredentialInput {
  const o = asObject(raw);
  const out: CredentialInput = {};
  const purpose = required(o, "purpose", MAX.label, "Role or purpose", onCreate);
  if (purpose !== undefined) out.purpose = purpose;
  const username = required(o, "username", MAX.short, "Username", onCreate);
  if (username !== undefined) out.username = username;
  const notes = text(o, "notes", MAX.notes, "Notes");
  if (notes !== undefined) out.notes = notes;
  if ("password" in o) {
    const p = o.password;
    if (p === null || p === "") out.password = null;
    else if (typeof p !== "string") throw new EnvironmentError("Password must be text");
    else if (p.length > MAX.password) throw new EnvironmentError(`Password must be at most ${MAX.password} characters`);
    else out.password = p;
  }
  return out;
}

export function nameKey(name: string): string {
  return name.trim().toLowerCase();
}

/** The PROD rule, enforced on the server: a production environment can never hold test accounts. */
export function assertCanHoldCredentials(env: { name: string; isProduction: boolean }): void {
  if (env.isProduction) {
    throw new EnvironmentError(`"${env.name}" is marked Production, so it cannot store test users or passwords.`, 403);
  }
}

export function validateReorder(raw: unknown): string[] {
  const ids = asObject(raw).ids;
  if (!Array.isArray(ids) || ids.some((i) => typeof i !== "string") || new Set(ids).size !== ids.length) {
    throw new EnvironmentError("ids must be a list of unique environment ids");
  }
  return ids as string[];
}
