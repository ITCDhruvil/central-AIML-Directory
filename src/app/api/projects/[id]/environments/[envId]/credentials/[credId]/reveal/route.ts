import { NextRequest, NextResponse } from "next/server";
import { revealPassword } from "@/lib/environments/service";
import { envRoute } from "@/lib/environments/routeHelpers";

type RouteParams = { params: Promise<{ id: string; envId: string; credId: string }> };

/**
 * The only endpoint that returns a stored password. Needs edit rights on the project; every call is audited (who,
 * which account, never the password). POST, so it is never cached or prefetched, and the answer is no-store.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id, envId, credId } = await params;
  return envRoute(request, id, "edit", "POST reveal environment password", async (ctx) => {
    const { password, username, environmentName } = await revealPassword(id, envId, credId);
    await ctx.log("environment.credential_revealed", { environment: environmentName, username, credentialId: credId });
    return NextResponse.json({ password }, { headers: { "Cache-Control": "no-store" } });
  });
}
