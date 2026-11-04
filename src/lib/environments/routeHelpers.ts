import "server-only";
import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { authorizeProject } from "@/lib/environments/access";
import { EnvironmentError } from "@/lib/environments/validate";
import type { AuditAction } from "@/lib/auditCatalog";

export type Ctx = {
  userId: string;
  actorName: string;
  canEdit: boolean;
  request: Request;
  /** Records an audit event about this project's environments. Never include passwords in `meta`. */
  log: (action: AuditAction, meta: Record<string, unknown>) => Promise<void>;
};

/** Parses the JSON body, or answers 400 through the shared error mapping. */
export async function readBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new EnvironmentError("Invalid JSON body");
  }
}

/**
 * Shared shell of every environments route: sign-in + project permission ("edit" for anything that changes data),
 * error mapping, and an audit helper. `fn` returns the JSON payload and optionally a status.
 */
export async function envRoute(
  request: Request,
  projectId: string,
  need: "view" | "edit",
  label: string,
  fn: (ctx: Ctx) => Promise<unknown | Response>,
): Promise<Response> {
  const auth = await authorizeProject(projectId, need);
  if (!auth.ok) return auth.response;
  const ctx: Ctx = {
    userId: auth.user.id,
    actorName: auth.user.name,
    canEdit: auth.canEdit,
    request,
    log: (action, meta) => audit({ action, actorId: auth.user.id, entityType: "project", entityId: projectId, meta, request }),
  };
  try {
    const result = await fn(ctx);
    return result instanceof Response ? result : NextResponse.json(result);
  } catch (error) {
    if (error instanceof EnvironmentError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error(`${label} failed`, error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
