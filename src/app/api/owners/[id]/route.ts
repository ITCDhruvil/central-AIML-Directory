import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { apiAuthorize } from "@/lib/auth/dal";
import { NextRequest, NextResponse } from "next/server";
import { deleteOwnerById, OwnerNotFoundError } from "@/lib/owners";

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await apiAuthorize("owners", "delete");
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    const owner = await prisma.owner.findUnique({ where: { id }, select: { name: true } });
    await deleteOwnerById(id);
    await audit({ action: "owner.deleted", actorId: auth.user.id, entityType: "owner", entityId: id, meta: { name: owner?.name }, request });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof OwnerNotFoundError) {
      return NextResponse.json({ error: "Owner not found" }, { status: 404 });
    }
    console.error("DELETE /api/owners/[id] failed", error);
    return NextResponse.json({ error: "Failed to delete owner" }, { status: 500 });
  }
}
