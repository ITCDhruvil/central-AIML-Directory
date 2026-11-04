import { NextRequest } from "next/server";
import { deleteEnvironment, listEnvironments, updateEnvironment } from "@/lib/environments/service";
import { envRoute, readBody } from "@/lib/environments/routeHelpers";
import { validateEnvironment } from "@/lib/environments/validate";

type RouteParams = { params: Promise<{ id: string; envId: string }> };

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id, envId } = await params;
  return envRoute(request, id, "edit", "PUT environment", async (ctx) => {
    const input = validateEnvironment(await readBody(request), false);
    const environment = await updateEnvironment(id, envId, input, ctx.actorName);
    await ctx.log("environment.updated", { name: environment.name, fields: Object.keys(input) });
    return { environment, environments: await listEnvironments(id) };
  });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id, envId } = await params;
  return envRoute(request, id, "edit", "DELETE environment", async (ctx) => {
    const { name } = await deleteEnvironment(id, envId);
    await ctx.log("environment.deleted", { name });
    return { environments: await listEnvironments(id) };
  });
}
