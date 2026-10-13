import { NextRequest, NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { apiAuthorize } from "@/lib/auth/dal";
import { sanitizeBranding } from "@/lib/branding";
import { getBranding, setBranding } from "@/lib/brandingSettings";

export async function GET() {
  const auth = await apiAuthorize("settings", "view");
  if (!auth.ok) return auth.response;
  return NextResponse.json({ branding: await getBranding() });
}

/** Saves the workspace name and tagline. Shown on the next page load. */
export async function PUT(request: NextRequest) {
  const auth = await apiAuthorize("settings", "edit");
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = sanitizeBranding(typeof body === "object" && body !== null ? (body as Record<string, unknown>).branding : null);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const before = await getBranding();
    await setBranding(parsed.branding);
    if (before.appName !== parsed.branding.appName || before.tagline !== parsed.branding.tagline) {
      await audit({
        action: "settings.branding",
        actorId: auth.user.id,
        meta: { name: `${before.appName} → ${parsed.branding.appName}`, tagline: `${before.tagline} → ${parsed.branding.tagline}` },
        request,
      });
    }
    return NextResponse.json({ branding: parsed.branding });
  } catch (error) {
    console.error("PUT /api/settings/branding failed", error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
