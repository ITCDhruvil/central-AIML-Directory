import { NextRequest, NextResponse } from "next/server";
import {
  createDefaultEnvironments,
  createEnvironment,
  duplicateEnvironment,
  listEnvironments,
  reorderEnvironments,
} from "@/lib/environments/service";
import { envRoute, readBody } from "@/lib/environments/routeHelpers";
import { asObject, validateEnvironment, validateReorder } from "@/lib/environments/validate";

type RouteParams = { params: Promise<{ id: string }> };

/** The project's environments with their links and test accounts (passwords are never included). */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return envRoute(request, id, "view", "GET environments", async (ctx) => ({
    environments: await listEnvironments(id),
    canEdit: ctx.canEdit,
  }));
}

/**
 * Body: an environment's fields to create one, `{ defaults: true }` to add DEV/QA/UAT/PROD, or
 * `{ duplicateFrom: envId, name }` to copy an environment (without test accounts).
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return envRoute(request, id, "edit", "POST environments", async (ctx) => {
    const body = asObject(await readBody(request));
    if (body.defaults === true) {
      const environments = await createDefaultEnvironments(id, ctx.actorName);
      await ctx.log("environment.created", { name: "default environments" });
      return NextResponse.json({ environments }, { status: 201 });
    }
    if (typeof body.duplicateFrom === "string") {
      const name = validateEnvironment({ name: body.name }, true).name as string;
      const created = await duplicateEnvironment(id, body.duplicateFrom, name, ctx.actorName);
      await ctx.log("environment.created", { name, copiedFrom: body.duplicateFrom });
      return NextResponse.json({ environments: await listEnvironments(id), created }, { status: 201 });
    }
    const created = await createEnvironment(id, validateEnvironment(body, true), ctx.actorName);
    await ctx.log("environment.created", { name: created.name });
    return NextResponse.json({ environments: await listEnvironments(id), created }, { status: 201 });
  });
}

/** Reorders the environments. Body: `{ ids: [envId, ...] }` listing every environment once. */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return envRoute(request, id, "edit", "PATCH environments", async () => ({
    environments: await reorderEnvironments(id, validateReorder(await readBody(request))),
  }));
}
