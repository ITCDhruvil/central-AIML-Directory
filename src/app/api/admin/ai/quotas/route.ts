import { audit } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";
import { apiAuthorize } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";

export type QuotaRowDto = { userId: string; name: string; email: string; dailyRequests: number | null; monthlyTokens: number | null };

/** People with their own AI limits (an exception to the defaults). */
export async function GET() {
  const auth = await apiAuthorize("settings", "view");
  if (!auth.ok) return auth.response;
  const rows = await prisma.aiQuota.findMany({ include: { user: { select: { name: true, email: true } } }, orderBy: { user: { name: "asc" } } });
  const quotas: QuotaRowDto[] = rows.map((r) => ({
    userId: r.userId,
    name: r.user.name,
    email: r.user.email,
    dailyRequests: r.dailyRequests,
    monthlyTokens: r.monthlyTokens,
  }));
  return NextResponse.json({ quotas });
}

const limit = (v: unknown, max: number): number | null | undefined =>
  v === null ? null : typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max ? v : undefined;

/** Sets one person's limits. null inherits the default; 0 means unlimited for them. */
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
  const userId = typeof raw.userId === "string" ? raw.userId : "";
  const dailyRequests = limit(raw.dailyRequests, 100_000);
  const monthlyTokens = limit(raw.monthlyTokens, 1_000_000_000);
  if (!userId) return NextResponse.json({ error: "Choose a person." }, { status: 400 });
  if (dailyRequests === undefined || monthlyTokens === undefined) {
    return NextResponse.json({ error: "Limits must be whole numbers (0 = unlimited), or empty to use the default." }, { status: 400 });
  }
  if (dailyRequests === null && monthlyTokens === null) {
    return NextResponse.json({ error: "Set at least one limit, or remove the exception." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  await prisma.aiQuota.upsert({
    where: { userId },
    create: { userId, dailyRequests, monthlyTokens },
    update: { dailyRequests, monthlyTokens },
  });
  const quota: QuotaRowDto = { userId, name: user.name, email: user.email, dailyRequests, monthlyTokens };
  await audit({
    action: "settings.ai_quota",
    actorId: auth.user.id,
    entityType: "user",
    entityId: userId,
    meta: { name: user.name, dailyRequests, monthlyTokens },
    request,
  });
  return NextResponse.json({ quota });
}

/** Removes a person's exception, so the defaults apply to them again. */
export async function DELETE(request: NextRequest) {
  const auth = await apiAuthorize("settings", "edit");
  if (!auth.ok) return auth.response;
  const userId = request.nextUrl.searchParams.get("userId") ?? "";
  if (!userId) return NextResponse.json({ error: "Choose a person." }, { status: 400 });
  const removed = await prisma.aiQuota.deleteMany({ where: { userId } });
  if (removed.count > 0) {
    await audit({ action: "settings.ai_quota", actorId: auth.user.id, entityType: "user", entityId: userId, meta: { removed: true }, request });
  }
  return new NextResponse(null, { status: 204 });
}
