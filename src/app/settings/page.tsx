import { SettingsView } from "@/components/settings/SettingsView";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { createdAt: true, lastLoginAt: true },
  });

  return (
    <SettingsView
      user={user}
      createdAt={record?.createdAt.toISOString() ?? null}
      lastLoginAt={record?.lastLoginAt?.toISOString() ?? null}
      canEditWorkspace={can(user.permissions, "settings", "edit")}
    />
  );
}
