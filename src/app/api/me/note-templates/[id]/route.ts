import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { deleteTemplate } from "@/lib/noteExtras";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { id } = await params;
  return (await deleteTemplate(user.id, id)) ? new NextResponse(null, { status: 204 }) : NextResponse.json({ error: "Template not found" }, { status: 404 });
}
