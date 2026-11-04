import { NextRequest, NextResponse } from "next/server";
import { createCredential } from "@/lib/environments/service";
import { envRoute, readBody } from "@/lib/environments/routeHelpers";
import { validateCredential } from "@/lib/environments/validate";

type RouteParams = { params: Promise<{ id: string; envId: string }> };

/** Adds a test account. Refused (403) for a Production environment, whatever the UI shows. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id, envId } = await params;
  return envRoute(request, id, "edit", "POST environment credential", async (ctx) => {
    const input = validateCredential(await readBody(request), true);
    const environment = await createCredential(id, envId, input, ctx.actorName);
    await ctx.log("environment.credential_saved", { environment: environment.name, username: input.username, purpose: input.purpose });
    return NextResponse.json({ environment }, { status: 201 });
  });
}
