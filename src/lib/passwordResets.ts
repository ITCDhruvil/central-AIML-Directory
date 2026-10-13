import { audit } from "@/lib/audit";
import "server-only";
import { prisma } from "@/lib/prisma";
import { usernameToEmail } from "@/lib/emailDomain";
import { getEmailDomain } from "@/lib/emailDomainSettings";
import { generateTempPassword } from "@/lib/auth/adminRules";
import { hashPassword } from "@/lib/auth/password";
import { autoIssueAt, autoIssueDue } from "@/lib/resetTiming";
import { getSecurityPolicy } from "@/lib/securityPolicySettings";

export type ResetRequestDto = {
  id: string;
  userId: string;
  name: string;
  email: string;
  createdAt: string;
  /** Asked while signed in: gets a temporary password automatically if nobody answers in time. */
  viaSession: boolean;
  autoIssueAt: string | null;
};

/**
 * Records that someone asked for a password reset, so admins can act on it. It deliberately says nothing about whether the
 * account exists: unknown or deactivated accounts are ignored silently, and a repeat request while one is already open
 * doesn't create another. The caller always shows the same "an admin has been notified" message.
 */
export async function requestPasswordReset(rawUsername: string): Promise<void> {
  const built = usernameToEmail(rawUsername, await getEmailDomain());
  if (!built.ok) return;

  const user = await prisma.user.findUnique({ where: { email: built.email }, select: { id: true, active: true } });
  if (!user || !user.active) return;

  const open = await prisma.passwordResetRequest.findFirst({ where: { userId: user.id, status: "PENDING" }, select: { id: true } });
  if (open) return;

  await prisma.passwordResetRequest.create({ data: { email: built.email, userId: user.id } });
  await audit({ action: "auth.password_reset_requested", actorId: user.id, entityType: "user", entityId: user.id, meta: { email: built.email, via: "sign-in page" } });
}

/** Open requests, oldest first, for accounts that still exist and are active. */
export async function listPendingResetRequests(): Promise<ResetRequestDto[]> {
  const { resetAutoIssueMinutes } = await getSecurityPolicy();
  const rows = await prisma.passwordResetRequest.findMany({
    where: { status: "PENDING", user: { active: true } },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.flatMap((r) =>
    r.user
      ? [
          {
            id: r.id,
            userId: r.user.id,
            name: r.user.name,
            email: r.user.email,
            createdAt: r.createdAt.toISOString(),
            viaSession: r.viaSession,
            autoIssueAt: r.viaSession ? (autoIssueAt(r.createdAt, resetAutoIssueMinutes)?.toISOString() ?? null) : null,
          },
        ]
      : [],
  );
}

/** Marks a request as dismissed without resetting anything. Returns false when it isn't an open request. */
export async function dismissResetRequest(id: string, actorId: string): Promise<boolean> {
  const result = await prisma.passwordResetRequest.updateMany({
    where: { id, status: "PENDING" },
    data: { status: "REJECTED", resolvedAt: new Date(), resolvedById: actorId },
  });
  return result.count > 0;
}

export type OwnResetState =
  | { state: "none" }
  | { state: "pending"; createdAt: string; autoIssueAt: string | null }
  | { state: "issued"; temporaryPassword: string; sessionVersion: number };

/** A signed-in person asks for a reset ("I forgot my current password"). One open request at a time. */
export async function requestOwnPasswordReset(userId: string): Promise<OwnResetState> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, active: true } });
  if (!user || !user.active) return { state: "none" };

  const open = await prisma.passwordResetRequest.findFirst({ where: { userId, status: "PENDING" }, orderBy: { createdAt: "desc" } });
  const row = open ?? (await prisma.passwordResetRequest.create({ data: { email: user.email, userId, viaSession: true } }));
  if (!open) await audit({ action: "auth.password_reset_requested", actorId: userId, entityType: "user", entityId: userId, meta: { email: user.email, via: "settings" } });
  const { resetAutoIssueMinutes } = await getSecurityPolicy();
  return {
    state: "pending",
    createdAt: row.createdAt.toISOString(),
    autoIssueAt: autoIssueAt(row.createdAt, resetAutoIssueMinutes)?.toISOString() ?? null,
  };
}

/**
 * Where the signed-in person's own reset request stands. When the administrator's window has passed, this is also the
 * moment the temporary password is issued, so it is handed straight to the session that is waiting for it and never
 * stored anywhere readable. Safe to call repeatedly: only one caller can close the request.
 */
export async function checkOwnPasswordReset(userId: string, now: Date = new Date()): Promise<OwnResetState> {
  const open = await prisma.passwordResetRequest.findFirst({
    where: { userId, status: "PENDING", viaSession: true },
    orderBy: { createdAt: "desc" },
  });
  if (!open) return { state: "none" };
  const { resetAutoIssueMinutes } = await getSecurityPolicy();
  if (!autoIssueDue(open.createdAt, resetAutoIssueMinutes, now)) {
    return {
      state: "pending",
      createdAt: open.createdAt.toISOString(),
      autoIssueAt: autoIssueAt(open.createdAt, resetAutoIssueMinutes)?.toISOString() ?? null,
    };
  }

  const temporaryPassword = generateTempPassword();
  const hash = await hashPassword(temporaryPassword);
  const result = await prisma.$transaction(async (tx) => {
    // Whoever closes the request first gets to issue the password; anyone else sees it as already handled.
    const closed = await tx.passwordResetRequest.updateMany({
      where: { id: open.id, status: "PENDING" },
      data: { status: "RESOLVED", resolvedAt: now },
    });
    if (closed.count === 0) return null;

    const current = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } });
    await tx.passwordHistory.create({ data: { userId, hash: current.passwordHash } });
    return tx.user.update({
      where: { id: userId },
      data: { passwordHash: hash, mustChangePassword: true, sessionVersion: { increment: 1 } },
      select: { sessionVersion: true },
    });
  });
  if (!result) return { state: "none" };
  await audit({ action: "auth.password_auto_issued", actorId: userId, entityType: "user", entityId: userId, meta: { waitedMinutes: resetAutoIssueMinutes } });
  return { state: "issued", temporaryPassword, sessionVersion: result.sessionVersion };
}
