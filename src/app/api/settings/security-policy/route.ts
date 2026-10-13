import { audit } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";
import { apiAuthorize } from "@/lib/auth/dal";
import { sanitizePolicy } from "@/lib/securityPolicy";
import { getSecurityPolicy, setSecurityPolicy } from "@/lib/securityPolicySettings";

export async function GET() {
  const auth = await apiAuthorize("settings", "view");
  if (!auth.ok) return auth.response;
  return NextResponse.json({ policy: await getSecurityPolicy() });
}

/** Saves the security policy. Takes effect for the next sign-in or password change; existing sessions keep their expiry. */
export async function PUT(request: NextRequest) {
  const auth = await apiAuthorize("settings", "edit");
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = sanitizePolicy(typeof body === "object" && body !== null ? (body as Record<string, unknown>).policy : null);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const before = await getSecurityPolicy();
    await setSecurityPolicy(parsed.policy);
    const changed = (Object.keys(parsed.policy) as (keyof typeof parsed.policy)[]).filter((k) => parsed.policy[k] !== before[k]);
    if (changed.length > 0) {
      await audit({
        action: "settings.security_policy",
        actorId: auth.user.id,
        meta: { changed, ...Object.fromEntries(changed.map((k) => [k, `${before[k]} → ${parsed.policy[k]}`])) },
        request,
      });
    }
    return NextResponse.json({ policy: parsed.policy });
  } catch (error) {
    console.error("PUT /api/settings/security-policy failed", error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
