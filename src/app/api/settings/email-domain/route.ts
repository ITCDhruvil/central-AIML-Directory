import { audit } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";
import { apiAuthorize } from "@/lib/auth/dal";
import { emailMatchesDomain, normalizeEmailDomain } from "@/lib/emailDomain";
import { countAccountsOutsideDomain, getEmailDomain, setEmailDomain } from "@/lib/emailDomainSettings";

export async function GET() {
  const auth = await apiAuthorize("settings", "view");
  if (!auth.ok) return auth.response;
  return NextResponse.json({ domain: await getEmailDomain() });
}

/**
 * Admin-only: changes the email domain people sign in with. Two safeguards, because a wrong change locks people out:
 * you can't pick a domain your own account isn't on, and if other active accounts would be affected the change needs
 * an explicit confirm.
 */
export async function PUT(request: NextRequest) {
  const auth = await apiAuthorize("settings", "edit");
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const raw = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};

  const domain = normalizeEmailDomain(raw.domain);
  if (!domain) {
    return NextResponse.json({ error: "Enter a domain like company.com." }, { status: 400 });
  }
  if (!emailMatchesDomain(auth.user.email, domain)) {
    return NextResponse.json(
      { error: `Your own account is ${auth.user.email}, so switching to @${domain} would lock you out.` },
      { status: 409 },
    );
  }

  const affected = await countAccountsOutsideDomain(domain);
  if (affected > 0 && raw.confirm !== true) {
    return NextResponse.json(
      {
        error: `${affected} active ${affected === 1 ? "account uses" : "accounts use"} a different domain and could no longer sign in with just a username.`,
        needsConfirm: true,
        affected,
      },
      { status: 409 },
    );
  }

  const previous = await getEmailDomain();
  await setEmailDomain(domain);
  await audit({ action: "settings.email_domain", actorId: auth.user.id, meta: { from: previous, to: domain, accountsAffected: affected }, request });
  return NextResponse.json({ domain, affected });
}
