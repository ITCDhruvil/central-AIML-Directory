import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/dal";
import { deleteGithubConnection, getGithubConnectionStatus, isGithubOAuthConfigured } from "@/lib/github/connection";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const status = await getGithubConnectionStatus(user.id);
  return NextResponse.json({ ...status, configured: isGithubOAuthConfigured() });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  await deleteGithubConnection(user.id);
  await audit({ action: "github.disconnected", actorId: user.id, entityType: "user", entityId: user.id });
  return NextResponse.json({ ok: true });
}
