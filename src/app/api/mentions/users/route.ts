import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";

/**
 * People for the editor's @mention list: active users whose name matches. Only id and name come back (never an email),
 * and any signed-in person may ask, since colleagues' names already show across the app.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const tokens = (request.nextUrl.searchParams.get("q") ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 4);
  const users = await prisma.user.findMany({
    where: { active: true, AND: tokens.map((t) => ({ name: { contains: t, mode: "insensitive" as const } })) },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 6,
  });
  return NextResponse.json({ users });
}
