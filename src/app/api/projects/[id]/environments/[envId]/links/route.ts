import { NextRequest, NextResponse } from "next/server";
import { createLink } from "@/lib/environments/service";
import { envRoute, readBody } from "@/lib/environments/routeHelpers";
import { validateLink } from "@/lib/environments/validate";

type RouteParams = { params: Promise<{ id: string; envId: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id, envId } = await params;
  return envRoute(request, id, "edit", "POST environment link", async (ctx) => {
    const environment = await createLink(id, envId, validateLink(await readBody(request), true), ctx.actorName);
    await ctx.log("environment.updated", { name: environment.name, fields: ["links"] });
    return NextResponse.json({ environment }, { status: 201 });
  });
}
