import { RolePermissionsEditor } from "@/components/admin/RolePermissionsEditor";
import { requirePagePermission } from "@/lib/auth/dal";
import { loadRoleMatrix } from "@/lib/auth/roleMatrix";

export const dynamic = "force-dynamic";

export default async function PermissionsPage() {
  await requirePagePermission("users", "view");
  const roles = await loadRoleMatrix();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Role permissions</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Default access for each role. Switch an area off, limit it to a user&apos;s own items, or allow everything.
          Individual users can be given different access on the Users page.
        </p>
      </div>
      <RolePermissionsEditor initialRoles={roles} />
    </div>
  );
}
