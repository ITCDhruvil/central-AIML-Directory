import { NextRequest, NextResponse } from "next/server";
import { deleteOwnerById, OwnerNotFoundError } from "@/lib/owners";

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    await deleteOwnerById(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof OwnerNotFoundError) {
      return NextResponse.json({ error: "Owner not found" }, { status: 404 });
    }
    console.error("DELETE /api/owners/[id] failed", error);
    return NextResponse.json({ error: "Failed to delete owner" }, { status: 500 });
  }
}
