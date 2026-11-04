import { NextRequest } from "next/server";
import { pingEnvironment } from "@/lib/environments/service";
import { envRoute } from "@/lib/environments/routeHelpers";

type RouteParams = { params: Promise<{ id: string; envId: string }> };

/** Calls the environment's health-check URL and stores LIVE or DOWN on it. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id, envId } = await params;
  return envRoute(request, id, "edit", "POST environment ping", async (ctx) => ({
    environment: await pingEnvironment(id, envId, ctx.actorName),
  }));
}
