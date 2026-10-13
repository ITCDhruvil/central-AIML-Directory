import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { actionLabel, AUDIT_ACTIONS, type AuditCategory } from "@/lib/auditCatalog";
import { AUDIT_PAGE_SIZE, type AuditFilter } from "@/lib/auditFilter";

export type AuditEntryDto = {
  id: string;
  createdAt: string;
  action: string;
  label: string;
  category: AuditCategory | null;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  entityType: string | null;
  entityId: string | null;
  meta: Record<string, unknown>;
  ip: string | null;
};

function toWhere(f: AuditFilter): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};
  if (f.actions) where.action = { in: f.actions };
  if (f.actorId) where.actorId = f.actorId;
  if (f.days) where.createdAt = { gte: new Date(Date.now() - f.days * 86_400_000) };
  if (f.q) {
    const contains = { contains: f.q, mode: "insensitive" as const };
    where.OR = [
      { meta: contains },
      { entityId: contains },
      { action: contains },
      { actor: { is: { OR: [{ name: contains }, { email: contains }] } } },
    ];
  }
  return where;
}

function parseMeta(raw: string): Record<string, unknown> {
  try {
    const v = JSON.parse(raw);
    return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function queryAudit(
  f: AuditFilter,
  opts: { pageSize?: number } = {},
): Promise<{ entries: AuditEntryDto[]; total: number; page: number; pageSize: number }> {
  const pageSize = opts.pageSize ?? AUDIT_PAGE_SIZE;
  const where = toWhere(f);
  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (f.page - 1) * pageSize,
      take: pageSize,
      include: { actor: { select: { name: true, email: true } } },
    }),
  ]);
  const entries = rows.map<AuditEntryDto>((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    action: r.action,
    label: actionLabel(r.action),
    category: (AUDIT_ACTIONS as Record<string, { category: AuditCategory }>)[r.action]?.category ?? null,
    actorId: r.actorId,
    actorName: r.actor?.name ?? null,
    actorEmail: r.actor?.email ?? null,
    entityType: r.entityType,
    entityId: r.entityId,
    meta: parseMeta(r.meta),
    ip: r.ip,
  }));
  return { entries, total, page: f.page, pageSize };
}
