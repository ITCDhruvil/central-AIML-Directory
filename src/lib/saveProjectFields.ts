import type { Project } from "@/types/project";

export async function saveProjectFields(id: string, patch: Record<string, unknown>): Promise<Project> {
  const res = await fetch(`/api/projects/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "Failed to save");
  }
  return body.project as Project;
}
