import { prisma } from "@/lib/prisma";

export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "project";
}

async function findUniqueSlug(
  base: string,
  excludeId: string | undefined,
  findBySlug: (slug: string) => Promise<{ id: string } | null>,
): Promise<string> {
  let candidate = base;
  let suffix = 2;

  while (true) {
    const existing = await findBySlug(candidate);
    if (!existing || existing.id === excludeId) {
      return candidate;
    }
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

export async function uniqueSlug(name: string, excludeId?: string): Promise<string> {
  return findUniqueSlug(slugify(name), excludeId, (slug) => prisma.project.findUnique({ where: { slug } }));
}

export async function uniqueIdeaSlug(name: string, excludeId?: string): Promise<string> {
  return findUniqueSlug(slugify(name), excludeId, (slug) => prisma.idea.findUnique({ where: { slug } }));
}
