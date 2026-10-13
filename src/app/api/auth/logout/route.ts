import { NextRequest, NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/dal";
import { clearSessionCookie } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  await clearSessionCookie();
  if (user) await audit({ action: "auth.logout", actorId: user.id, request });
  return NextResponse.json({ ok: true });
}
