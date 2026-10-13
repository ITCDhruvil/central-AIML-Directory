import type { Idea } from "@/types/idea";

/** Saves part of an idea (owner, technologies, tags…) and returns the updated idea. Throws with the server's message. */
export async function saveIdeaFields(id: string, patch: Record<string, unknown>): Promise<Idea> {
  const res = await fetch(`/api/ideas/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "Failed to save");
  }
  return body.idea as Idea;
}
