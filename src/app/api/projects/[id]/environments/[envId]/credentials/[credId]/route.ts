import { NextRequest } from "next/server";
import { deleteCredential, updateCredential } from "@/lib/environments/service";
import { envRoute, readBody } from "@/lib/environments/routeHelpers";
import { validateCredential } from "@/lib/environments/validate";

type RouteParams = { params: Promise<{ id: string; envId: string; credId: string }> };

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id, envId, credId } = await params;
  return envRoute(request, id, "edit", "PUT environment credential", async (ctx) => {
    const input = validateCredential(await readBody(request), false);
    const environment = await updateCredential(id, envId, credId, input, ctx.actorName);
    await ctx.log("environment.credential_saved", {
      environment: environment.name,
      credentialId: credId,
      // Which fields changed, never their values.
      fields: Object.keys(input),
    });
    return { environment };
  });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id, envId, credId } = await params;
  return envRoute(request, id, "edit", "DELETE environment credential", async (ctx) => {
    const { environment, username } = await deleteCredential(id, envId, credId);
    await ctx.log("environment.credential_deleted", { environment: environment.name, username });
    return { environment };
  });
}
