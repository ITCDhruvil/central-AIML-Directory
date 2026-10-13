import "server-only";
import { prisma } from "@/lib/prisma";
import { sanitizeMeta, type AuditAction } from "@/lib/auditCatalog";

/** Best-effort client address from the proxy headers. Only a hint: it is not verified. */
export function clientIp(request: Request | undefined | null): string | null {
  const forwarded = request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || null;
}

/**
 * Records one event. Never throws and never blocks the action it describes: if the log can't be written the error is
 * printed and the request carries on. Metadata is stripped of anything secret-looking (see sanitizeMeta).
 */
export async function audit(entry: {
  action: AuditAction;
  actorId?: string | null;
  entityType?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
  request?: Request | null;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        actorId: entry.actorId ?? null,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        meta: JSON.stringify(sanitizeMeta(entry.meta)),
        ip: clientIp(entry.request),
      },
    });
  } catch (error) {
    console.error("audit write failed", entry.action, error);
  }
}
