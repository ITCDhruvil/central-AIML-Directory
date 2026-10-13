import { scopeFor, type PermissionSet } from "@/lib/auth/permissions";

/**
 * Users limited to their own items only see what they own, so an item they create without an
 * owner would vanish from their own view. Default the owner to the creator in that case.
 */
export function withOwnerDefault(
  body: unknown,
  user: { name: string; permissions: PermissionSet },
  resource: "projects" | "ideas",
): unknown {
  if (typeof body !== "object" || body === null) return body;
  if (scopeFor(user.permissions, resource, "view") !== "OWN") return body;
  const owner = (body as Record<string, unknown>).owner;
  if (typeof owner === "string" && owner.trim()) return body;
  return { ...(body as Record<string, unknown>), owner: user.name };
}
