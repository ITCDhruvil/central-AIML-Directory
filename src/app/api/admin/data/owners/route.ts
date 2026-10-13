import { NextResponse } from "next/server";
import { apiAuthorize } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";

export type OwnerUsageDto = { id: string; name: string; projects: number; ideas: number; linkedUser: string | null };

/**
 * Every owner name with how many projects and ideas mention it and which account it is linked to, so unused or
 * misspelled names can be spotted and removed. A project's owner is free text, so "mentions" is a case-insensitive match.
 */
export async function GET() {
  const auth = await apiAuthorize("settings", "edit");
  if (!auth.ok) return auth.response;

  try {
    const owners = await prisma.owner.findMany({ orderBy: { name: "asc" }, include: { user: { select: { name: true } } } });
    const owners2: OwnerUsageDto[] = await Promise.all(
      owners.map(async (o) => {
        const match = { contains: o.name, mode: "insensitive" as const };
        const [projects, ideas] = await Promise.all([
          prisma.project.count({ where: { owner: match } }),
          prisma.idea.count({ where: { owner: match } }),
        ]);
        return { id: o.id, name: o.name, projects, ideas, linkedUser: o.user?.name ?? null };
      }),
    );
    return NextResponse.json({ owners: owners2 });
  } catch (error) {
    console.error("GET /api/admin/data/owners failed", error);
    return NextResponse.json({ error: "Failed to load owner names" }, { status: 500 });
  }
}
