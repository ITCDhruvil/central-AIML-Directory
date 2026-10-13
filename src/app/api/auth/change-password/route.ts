import { audit } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/dal";
import { hashPassword, validatePasswordStrength, verifyPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { isPasswordReused, rememberPasswordHash } from "@/lib/auth/passwordHistory";
import { PASSWORD_REUSED_MESSAGE } from "@/lib/auth/passwordReuse";
import { getSecurityPolicy } from "@/lib/securityPolicySettings";

export async function POST(request: NextRequest) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const raw = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const currentPassword = typeof raw.currentPassword === "string" ? raw.currentPassword : "";
  const newPassword = typeof raw.newPassword === "string" ? raw.newPassword : "";

  const policy = await getSecurityPolicy();
  const weakness = validatePasswordStrength(newPassword, policy);
  if (weakness) return NextResponse.json({ error: weakness }, { status: 400 });
  if (newPassword === currentPassword) {
    return NextResponse.json({ error: "New password must differ from the current one." }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: current.id } });
    if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
    }

    if (await isPasswordReused(user.id, user.passwordHash, newPassword, policy.passwordHistoryCount)) {
      return NextResponse.json({ error: PASSWORD_REUSED_MESSAGE }, { status: 400 });
    }

    // Bumping sessionVersion signs out every other device; the fresh cookie keeps this one in. The old hash goes
    // into the history in the same transaction, so it is blocked from now on.
    const [updated] = await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await hashPassword(newPassword),
          mustChangePassword: false,
          sessionVersion: { increment: 1 },
        },
      }),
      rememberPasswordHash(user.id, user.passwordHash),
    ]);
    await setSessionCookie(updated.id, updated.sessionVersion);
    await audit({ action: "auth.password_changed", actorId: user.id, meta: { forced: user.mustChangePassword }, request });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/auth/change-password failed", error);
    return NextResponse.json({ error: "Failed to change password" }, { status: 500 });
  }
}
