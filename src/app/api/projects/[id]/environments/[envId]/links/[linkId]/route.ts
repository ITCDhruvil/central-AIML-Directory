import { NextRequest } from "next/server";
import { deleteLink, updateLink } from "@/lib/environments/service";
import { envRoute, readBody } from "@/lib/environments/routeHelpers";
import { validateLink } from "@/lib/environments/validate";

type RouteParams = { params: Promise<{ id: string; envId: string; linkId: string }> };

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id, envId, linkId } = await params;
  return envRoute(request, id, "edit", "PUT environment link", async (ctx) => {
    const environment = await updateLink(id, envId, linkId, validateLink(await readBody(request), false), ctx.actorName);
    await ctx.log("environment.updated", { name: environment.name, fields: ["links"] });
    return { environment };
  });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id, envId, linkId } = await params;
  return envRoute(request, id, "edit", "DELETE environment link", async (ctx) => {
    const environment = await deleteLink(id, envId, linkId);
    await ctx.log("environment.updated", { name: environment.name, fields: ["links"] });
    return { environment };
  });
}
