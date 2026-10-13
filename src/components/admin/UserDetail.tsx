"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, KeyRound, Save } from "lucide-react";
import { PermissionGrid, type GridValues } from "@/components/admin/PermissionGrid";
import { TempPasswordNotice } from "@/components/admin/TempPasswordNotice";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ADMIN_SELECT_TRIGGER, ROLE_OPTIONS } from "@/components/admin/roleOptions";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { cn } from "@/lib/cn";
import type { AdminUserDto } from "@/lib/auth/adminUsers";
import type { PermissionSet, Role, Scope } from "@/lib/auth/permissions";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/auth/permissionLabels";

export type OwnerOption = { id: string; name: string; userId: string | null; userName: string | null };

const fieldClass =
  "h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Message({ state }: { state: { kind: "ok" | "error"; text: string } | null }) {
  if (!state) return null;
  return (
    <p
      role={state.kind === "error" ? "alert" : "status"}
      className={cn("text-sm", state.kind === "error" ? "text-red-600" : "text-green-600 dark:text-green-400")}
    >
      {state.text}
    </p>
  );
}

async function send<T>(url: string, method: string, body?: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) return { ok: false, error: data.error ?? "Request failed" };
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Network error — please try again" };
  }
}

export function UserDetail({
  initialUser,
  initialOverrides,
  roleDefaults,
  owners,
  isSelf,
}: {
  initialUser: AdminUserDto;
  initialOverrides: Record<string, Scope>;
  roleDefaults: Record<Role, PermissionSet>;
  owners: OwnerOption[];
  isSelf: boolean;
}) {
  const [user, setUser] = useState(initialUser);
  const [name, setName] = useState(initialUser.name);
  const [profileMsg, setProfileMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set(initialUser.owners.map((o) => o.id)));
  const [savedLinkedIds, setSavedLinkedIds] = useState<Set<string>>(new Set(initialUser.owners.map((o) => o.id)));
  const [ownersMsg, setOwnersMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [savingOwners, setSavingOwners] = useState(false);

  const [savedOverrides, setSavedOverrides] = useState<Record<string, Scope>>(initialOverrides);
  const [draft, setDraft] = useState<GridValues>(initialOverrides);
  const [permMsg, setPermMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [savingPerms, setSavingPerms] = useState(false);

  async function patch(change: { name?: string; role?: Role; active?: boolean }, okText: string) {
    setSavingProfile(true);
    setProfileMsg(null);
    const result = await send<{ user: AdminUserDto }>(`/api/admin/users/${user.id}`, "PATCH", change);
    setSavingProfile(false);
    if (!result.ok) {
      setProfileMsg({ kind: "error", text: result.error });
      return;
    }
    setUser(result.data.user);
    setName(result.data.user.name);
    setProfileMsg({ kind: "ok", text: okText });
  }

  async function resetPassword() {
    setResetting(true);
    const result = await send<{ temporaryPassword: string }>(`/api/admin/users/${user.id}/reset-password`, "POST");
    setResetting(false);
    setConfirmReset(false);
    if (!result.ok) {
      setProfileMsg({ kind: "error", text: result.error });
      return;
    }
    setTempPassword(result.data.temporaryPassword);
  }

  async function saveOwners() {
    setSavingOwners(true);
    setOwnersMsg(null);
    const result = await send<{ user: AdminUserDto }>(`/api/admin/users/${user.id}/owners`, "PUT", {
      ownerIds: [...linkedIds],
    });
    setSavingOwners(false);
    if (!result.ok) {
      setOwnersMsg({ kind: "error", text: result.error });
      return;
    }
    setUser(result.data.user);
    setSavedLinkedIds(new Set(linkedIds));
    setOwnersMsg({ kind: "ok", text: "Owner names saved." });
  }

  function changePermission(key: string, scope: Scope | null) {
    setPermMsg(null);
    setDraft((prev) => ({ ...prev, [key]: scope }));
  }

  // Only keys whose value differs from what is stored are sent; null removes an override.
  function pendingChanges(): Record<string, Scope | null> {
    const out: Record<string, Scope | null> = {};
    for (const key of new Set([...Object.keys(savedOverrides), ...Object.keys(draft)])) {
      const before = savedOverrides[key] ?? null;
      const after = draft[key] ?? null;
      if (before !== after) out[key] = after;
    }
    return out;
  }

  const changes = pendingChanges();
  const permsDirty = Object.keys(changes).length > 0;
  const ownersDirty =
    linkedIds.size !== savedLinkedIds.size || [...linkedIds].some((id) => !savedLinkedIds.has(id));

  async function savePermissions() {
    setSavingPerms(true);
    setPermMsg(null);
    const result = await send<{ overrides: Record<string, Scope> }>(`/api/admin/users/${user.id}/permissions`, "PUT", {
      overrides: changes,
    });
    setSavingPerms(false);
    if (!result.ok) {
      setPermMsg({ kind: "error", text: result.error });
      return;
    }
    setSavedOverrides(result.data.overrides);
    setDraft(result.data.overrides);
    setPermMsg({ kind: "ok", text: "Permissions saved. They apply on this user's next request." });
  }

  function toggleOwner(id: string) {
    setOwnersMsg(null);
    setLinkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <ArrowLeft size={14} />
        All users
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{user.name}</h1>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{user.email}</p>
      </div>

      {tempPassword && (
        <TempPasswordNotice email={user.email} password={tempPassword} onDismiss={() => setTempPassword(null)} />
      )}

      <Card title="Profile and access">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
            Name
            <div className="flex gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} className={cn(fieldClass, "w-full")} />
              <Button
                variant="secondary"
                disabled={savingProfile || !name.trim() || name.trim() === user.name}
                onClick={() => patch({ name: name.trim() }, "Name updated.")}
              >
                Save
              </Button>
            </div>
          </label>

          <label className="space-y-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
            Role
            <Dropdown
              value={user.role}
              disabled={savingProfile}
              onChange={(value) => patch({ role: value as Role }, "Role updated.")}
              options={ROLE_OPTIONS}
              triggerClassName={ADMIN_SELECT_TRIGGER}
              aria-label="Role"
            />
            <span className="block text-[11px] font-normal text-zinc-400">{ROLE_DESCRIPTIONS[user.role]}</span>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            variant={user.active ? "danger" : "primary"}
            disabled={savingProfile}
            onClick={() => patch({ active: !user.active }, user.active ? "User deactivated." : "User activated.")}
          >
            {user.active ? "Deactivate user" : "Activate user"}
          </Button>
          <Button variant="secondary" icon={KeyRound} disabled={savingProfile} onClick={() => setConfirmReset(true)}>
            Reset password
          </Button>
          {isSelf && <span className="text-xs text-zinc-400">This is your own account.</span>}
          <Message state={profileMsg} />
        </div>
      </Card>

      <Card
        title="Owner names"
        hint="Items whose owner matches a linked name count as this user's own. Used when their access is limited to Own."
      >
        {owners.length === 0 ? (
          <p className="text-sm text-zinc-400">No owner names exist yet. They are created when a project or idea gets an owner.</p>
        ) : (
          <div className="grid max-h-64 gap-1 overflow-y-auto sm:grid-cols-2">
            {owners.map((owner) => {
              const takenByOther = owner.userId !== null && owner.userId !== user.id && !linkedIds.has(owner.id);
              return (
                <label
                  key={owner.id}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <input
                    type="checkbox"
                    checked={linkedIds.has(owner.id)}
                    onChange={() => toggleOwner(owner.id)}
                    className="h-4 w-4 accent-orange-600"
                  />
                  <span className="min-w-0 flex-1 truncate">{owner.name}</span>
                  {takenByOther && (
                    <span className="shrink-0 text-[11px] text-zinc-400">linked to {owner.userName ?? "another user"}</span>
                  )}
                </label>
              );
            })}
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="primary" icon={Save} loading={savingOwners} disabled={!ownersDirty} onClick={saveOwners}>
            Save owner names
          </Button>
          <Message state={ownersMsg} />
        </div>
      </Card>

      <Card
        title="Permissions"
        hint={
          user.role === "ADMIN"
            ? "Admins always have full access."
            : `Each setting follows the ${ROLE_LABELS[user.role]} role unless you change it here.`
        }
      >
        {user.role === "ADMIN" ? (
          <p className="text-sm text-zinc-500">Change the role to customise individual permissions.</p>
        ) : (
          <div className="space-y-4">
            <PermissionGrid
              mode="user"
              values={draft}
              effectiveDefaults={roleDefaults[user.role]}
              onChange={changePermission}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" icon={Save} loading={savingPerms} disabled={!permsDirty} onClick={savePermissions}>
                Save permissions
              </Button>
              <Button
                variant="secondary"
                disabled={savingPerms || Object.keys(savedOverrides).length === 0 && !permsDirty}
                onClick={() => setDraft({})}
              >
                Clear all overrides
              </Button>
              <Message state={permMsg} />
            </div>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={confirmReset}
        title="Reset password?"
        description={`This signs ${user.name} out everywhere and gives them a temporary password they must change at next sign-in.`}
        confirmLabel="Reset password"
        loading={resetting}
        onConfirm={resetPassword}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}
