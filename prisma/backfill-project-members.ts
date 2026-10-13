// One-off, additive and safe to re-run: for every project/idea whose free-text owner matches a user (by the
// user's name, or by an owner name linked to them), add that user to the team as Owner.
// Run: npm run db:backfill-members
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

async function main() {
  const { prisma } = await import("../src/lib/prisma");

  const users = await prisma.user.findMany({ where: { active: true }, include: { owners: true } });
  const byName = new Map<string, string>();
  for (const u of users) {
    byName.set(u.name.trim().toLowerCase(), u.id);
    for (const o of u.owners) byName.set(o.name.trim().toLowerCase(), u.id);
  }

  let added = 0;
  let skipped = 0;
  for (const entityType of ["PROJECT", "IDEA"] as const) {
    const rows =
      entityType === "PROJECT"
        ? await prisma.project.findMany({ select: { id: true, owner: true } })
        : await prisma.idea.findMany({ select: { id: true, owner: true } });
    for (const row of rows) {
      const userId = row.owner ? byName.get(row.owner.trim().toLowerCase()) : undefined;
      if (!userId) {
        skipped += 1;
        continue;
      }
      const existing = await prisma.itemShare.findUnique({
        where: { entityType_entityId_userId: { entityType, entityId: row.id, userId } },
      });
      if (existing) continue;
      await prisma.itemShare.create({ data: { entityType, entityId: row.id, userId, access: "OWNER" } });
      added += 1;
    }
  }

  console.log(`Added ${added} Owner membership(s). ${skipped} item(s) have an owner name that matches no user (left as a text label).`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
