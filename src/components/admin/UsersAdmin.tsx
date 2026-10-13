"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, UserCog } from "lucide-react";
import { CreateUserModal } from "@/components/admin/CreateUserModal";
import { TempPasswordNotice } from "@/components/admin/TempPasswordNotice";
import { ADMIN_SELECT_TRIGGER, ROLE_OPTIONS } from "@/components/admin/roleOptions";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { Switch } from "@/components/ui/Switch";
import { cn } from "@/lib/cn";
import type { AdminUserDto } from "@/lib/auth/adminUsers";
import type { PermissionSet, Role } from "@/lib/auth/permissions";

function formatLogin(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export function UsersAdmin({
  initialUsers,
  currentUserId,
  emailDomain,
  roleDefaults,
}: {
  initialUsers: AdminUserDto[];
  currentUserId: string;
  emailDomain: string;
  roleDefaults: Record<Role, PermissionSet>;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ email: string; password: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function handleCreated(user: AdminUserDto, password: string) {
    setUsers((prev) => [...prev, user].sort((x, y) => x.name.localeCompare(y.name)));
    setNotice({ email: user.email, password });
    setShowCreate(false);
  }

  async function patchUser(id: string, change: { role?: Role; active?: boolean }) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(change),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; user?: AdminUserDto };
      if (!res.ok || !body.user) {
        setError(body.error ?? "Failed to update user");
        return;
      }
      setUsers((prev) => prev.map((u) => (u.id === id ? body.user! : u)));
    } catch {
      setError("Network error — please try again");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {users.length} {users.length === 1 ? "user" : "users"}
        </p>
        <Button variant="primary" icon={Plus} onClick={() => setShowCreate(true)}>
          Add user
        </Button>
      </div>

      {notice && <TempPasswordNotice email={notice.email} password={notice.password} onDismiss={() => setNotice(null)} />}

      <CreateUserModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        emailDomain={emailDomain}
        roleDefaults={roleDefaults}
        onCreated={handleCreated}
      />

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {/* overflow is visible from md up so dropdown menus aren't clipped by the table box */}
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 md:overflow-visible">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-left text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <th className="px-4 py-2.5 font-medium">User</th>
              <th className="px-3 py-2.5 font-medium">Role</th>
              <th className="px-3 py-2.5 font-medium">Active</th>
              <th className="px-3 py-2.5 font-medium">Owner names</th>
              <th className="px-3 py-2.5 font-medium">Last sign-in</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {users.map((user) => (
              <tr key={user.id} className={cn(!user.active && "opacity-60")}>
                <td className="px-4 py-2.5">
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">
                    {user.name}
                    {user.id === currentUserId && <span className="ml-1.5 text-[11px] text-zinc-400">(you)</span>}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">{user.email}</div>
                  {user.mustChangePassword && (
                    <div className="text-[11px] text-orange-600">Must set a new password</div>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <Dropdown
                    className="w-36"
                    value={user.role}
                    disabled={busyId === user.id}
                    onChange={(value) => patchUser(user.id, { role: value as Role })}
                    options={ROLE_OPTIONS}
                    triggerClassName={ADMIN_SELECT_TRIGGER}
                    aria-label={`Role for ${user.name}`}
                  />
                </td>
                <td className="px-3 py-2.5">
                  <Switch
                    checked={user.active}
                    disabled={busyId === user.id}
                    onChange={(next) => patchUser(user.id, { active: next })}
                    label={`${user.active ? "Deactivate" : "Activate"} ${user.name}`}
                  />
                </td>
                <td className="px-3 py-2.5 text-xs text-zinc-600 dark:text-zinc-300">
                  {user.owners.length > 0 ? user.owners.map((o) => o.name).join(", ") : <span className="text-zinc-400">None linked</span>}
                </td>
                <td className="px-3 py-2.5 text-xs text-zinc-500 dark:text-zinc-400">{/* Rendered in the viewer's timezone, so server and browser text can differ by design. */}
                  <time dateTime={user.lastLoginAt ?? undefined} suppressHydrationWarning>
                    {formatLogin(user.lastLoginAt)}
                  </time>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <UserCog size={14} />
                    Manage
                    {user.overrideCount > 0 && (
                      <span className="rounded-full bg-orange-100 px-1.5 text-[10px] text-orange-700 dark:bg-orange-500/20 dark:text-orange-300">
                        {user.overrideCount}
                      </span>
                    )}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
