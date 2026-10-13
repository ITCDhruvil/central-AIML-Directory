import { ResetRequests } from "@/components/admin/ResetRequests";
import { UsersAdmin } from "@/components/admin/UsersAdmin";
import { listPendingResetRequests } from "@/lib/passwordResets";
import { requirePagePermission } from "@/lib/auth/dal";
import { listAdminUsers } from "@/lib/auth/adminUsers";
import { loadRoleMatrix } from "@/lib/auth/roleMatrix";
import { getEmailDomain } from "@/lib/emailDomainSettings";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const { user } = await requirePagePermission("users", "view");
  const [users, roleDefaults, emailDomain, resetRequests] = await Promise.all([
    listAdminUsers(),
    loadRoleMatrix(),
    getEmailDomain(),
    listPendingResetRequests(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Users</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Create accounts, set roles, and open a user to fine-tune what they can see and do.
        </p>
      </div>
      <ResetRequests initial={resetRequests} />
      <UsersAdmin
        initialUsers={users}
        currentUserId={user.id}
        emailDomain={emailDomain}
        roleDefaults={roleDefaults}
      />
    </div>
  );
}
