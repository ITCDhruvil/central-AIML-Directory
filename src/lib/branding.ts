// Browser-safe: the workspace name shown on the sign-in page, sidebar, top bar and browser tab.

export type Branding = { appName: string; tagline: string };

export const DEFAULT_BRANDING: Branding = {
  appName: "Central AI/ML",
  tagline: "Project Directory",
};

export const BRANDING_LIMITS = {
  appName: { min: 1, max: 40 },
  tagline: { min: 0, max: 60 },
} as const;

const clean = (v: string) => v.replace(/\s+/g, " ").trim();

export type BrandingResult =
  { ok: true; branding: Branding } | { ok: false; error: string };

/** Validates submitted branding. Names are plain text: control characters and angle brackets are refused. */
export function sanitizeBranding(raw: unknown): BrandingResult {
  if (typeof raw !== "object" || raw === null)
    return { ok: false, error: "Invalid settings." };
  const input = raw as Record<string, unknown>;
  const appName =
    typeof input.appName === "string"
      ? clean(input.appName)
      : DEFAULT_BRANDING.appName;
  const tagline =
    typeof input.tagline === "string"
      ? clean(input.tagline)
      : DEFAULT_BRANDING.tagline;

  const { appName: a, tagline: t } = BRANDING_LIMITS;
  if (appName.length < a.min || appName.length > a.max)
    return { ok: false, error: `Name must be ${a.min}–${a.max} characters.` };
  if (tagline.length > t.max)
    return {
      ok: false,
      error: `Tagline must be ${t.max} characters or fewer.`,
    };
  if (/[<>\u0000-\u001f]/.test(appName + tagline))
    return {
      ok: false,
      error: "Names can't contain < > or control characters.",
    };
  return { ok: true, branding: { appName, tagline } };
}

/** Reads a stored value, falling back to the defaults for anything invalid so a bad row can't blank the sign-in page. */
export function parseBranding(stored: string | null | undefined): Branding {
  if (!stored) return { ...DEFAULT_BRANDING };
  try {
    const result = sanitizeBranding(JSON.parse(stored));
    return result.ok ? result.branding : { ...DEFAULT_BRANDING };
  } catch {
    return { ...DEFAULT_BRANDING };
  }
}

/** "Name · Tagline" for the browser tab, or just the name when there is no tagline. */
export function documentTitle(b: Branding): string {
  return b.tagline ? `${b.appName} ${b.tagline}` : b.appName;
}
