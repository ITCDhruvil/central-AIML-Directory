import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { Owner } from "@/types/owner";

export class OwnerNotFoundError extends Error {}

function toOwner(row: { id: string; name: string }): Owner {
  return { id: row.id, name: row.name };
}

export async function listOwners(): Promise<Owner[]> {
  const rows = await prisma.owner.findMany({ orderBy: { name: "asc" } });
  return rows.map(toOwner);
}

export async function createOwner(name: string): Promise<Owner> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Owner name is required");
  }

  const existing = await prisma.owner.findFirst({
    where: { name: { equals: trimmed, mode: "insensitive" } },
  });
  if (existing) return toOwner(existing);

  try {
    const row = await prisma.owner.create({ data: { name: trimmed } });
    return toOwner(row);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const raced = await prisma.owner.findFirst({
        where: { name: { equals: trimmed, mode: "insensitive" } },
      });
      if (raced) return toOwner(raced);
    }
    throw error;
  }
}

/** Records a project/idea owner string in the shared catalog so it shows up in the dropdown. */
export async function ensureOwnerName(name: string | null | undefined): Promise<void> {
  const trimmed = name?.trim();
  if (!trimmed) return;
  await createOwner(trimmed);
}

export async function deleteOwnerById(id: string): Promise<void> {
  try {
    await prisma.owner.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new OwnerNotFoundError(`Owner ${id} not found`);
    }
    throw error;
  }
}
