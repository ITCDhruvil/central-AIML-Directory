import { audit } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";
import { apiAuthorize } from "@/lib/auth/dal";
import { sanitizeAiSettings } from "@/lib/aiSettings";
import { getAiSettings, setAiSettings } from "@/lib/ai/aiSettingsStore";

export async function GET() {
  const auth = await apiAuthorize("settings", "view");
  if (!auth.ok) return auth.response;
  return NextResponse.json({ settings: await getAiSettings() });
}

/** Saves the master switch, per-feature switches and default quotas. Takes effect within seconds. */
export async function PUT(request: NextRequest) {
  const auth = await apiAuthorize("settings", "edit");
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = sanitizeAiSettings(typeof body === "object" && body !== null ? (body as Record<string, unknown>).settings : null);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const before = await getAiSettings();
    await setAiSettings(parsed.settings);
    if (JSON.stringify(before) !== JSON.stringify(parsed.settings)) {
      const s = parsed.settings;
      await audit({
        action: "settings.ai",
        actorId: auth.user.id,
        meta: {
          enabled: s.enabled,
          featuresOff: Object.entries(s.features).filter(([, on]) => on === false).map(([k]) => k),
          defaultDailyRequests: s.defaultDailyRequests,
          defaultMonthlyTokens: s.defaultMonthlyTokens,
        },
        request,
      });
    }
    return NextResponse.json({ settings: parsed.settings });
  } catch (error) {
    console.error("PUT /api/admin/ai/settings failed", error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
