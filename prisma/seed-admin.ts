// Creates the first admin from ADMIN_EMAIL / ADMIN_PASSWORD (and optional ADMIN_NAME).
// Idempotent: an existing user with that email is left untouched unless --reset-password is passed.
// Run: npm run db:seed-admin   (after the auth migration has been applied)
// --if-configured: skip quietly when ADMIN_EMAIL / ADMIN_PASSWORD are not set (used by the build).
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || "Administrator";
  const resetPassword = process.argv.includes("--reset-password");

  if ((!email || !password) && process.argv.includes("--if-configured")) {
    console.log("ADMIN_EMAIL / ADMIN_PASSWORD not set; skipping admin seed.");
    return;
  }
  if (!email || !password) {
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD in .env.local before running this script.");
  }

  const { hashPassword, validatePasswordStrength } = await import("../src/lib/auth/password");
  const weakness = validatePasswordStrength(password);
  if (weakness) throw new Error(`ADMIN_PASSWORD rejected: ${weakness}`);

  const { prisma } = await import("../src/lib/prisma");
  const existing = await prisma.user.findUnique({ where: { email } });

  if (!existing) {
    await prisma.user.create({
      data: { email, name, role: "ADMIN", passwordHash: await hashPassword(password) },
    });
    console.log(`Created admin ${email}`);
  } else if (resetPassword) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash: await hashPassword(password),
        role: "ADMIN",
        active: true,
        sessionVersion: { increment: 1 },
      },
    });
    console.log(`Reset password and re-activated admin ${email}`);
  } else {
    console.log(`User ${email} already exists; nothing changed (use --reset-password to overwrite).`);
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
