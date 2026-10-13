"use client";

import { useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { PermissionGrid } from "@/components/admin/PermissionGrid";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  DEFAULT_ROLE_MATRIX,
  ROLES,
  resolvePermissions,
  type PermissionSet,
  type Role,
  type Scope,
} from "@/lib/auth/permissions";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/auth/permissionLabels";

type RoleMap = Record<Role, PermissionSet>;

function builtIn(role: Role): PermissionSet {
  return resolvePermissions(role, DEFAULT_ROLE_MATRIX[role], []);
}

function sameSet(a: PermissionSet, b: PermissionSet): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) if ((a[key] ?? "NONE") !== (b[key] ?? "NONE")) return false;
  return true;
}

export function RolePermissionsEditor({ initialRoles }: { initialRoles: RoleMap }) {
  const [saved, setSaved] = useState<RoleMap>(initialRoles);
  const [drafts, setDrafts] = useState<RoleMap>(initialRoles);
  const [role, setRole] = useState<Role>("MANAGER");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const draft = drafts[role];
  const dirty = !sameSet(draft, saved[role]);
  const atDefaults = sameSet(draft, builtIn(role));

  function change(key: string, scope: Scope | null) {
    if (scope === null) return;
    setMessage(null);
    setDrafts((prev) => ({ ...prev, [role]: { ...prev[role], [key]: scope } }));
  }

  function resetToDefaults() {
    setMessage(null);
    setDrafts((prev) => ({ ...prev, [role]: builtIn(role) }));
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, permissions: draft }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; roles?: RoleMap };
      if (!res.ok || !body.roles) {
        setMessage({ kind: "error", text: body.error ?? "Failed to save" });
        return;
      }
      setSaved(body.roles);
      setDrafts((prev) => ({ ...prev, [role]: body.roles![role] }));
      setMessage({ kind: "ok", text: `${ROLE_LABELS[role]} permissions saved. Changes apply on each user's next request.` });
    } catch {
      setMessage({ kind: "error", text: "Network error — please try again" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1 rounded-xl bg-white p-1 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800 sm:w-fit">
        {ROLES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => {
              setRole(r);
              setMessage(null);
            }}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              role === r
                ? "bg-orange-600 text-white"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
            )}
          >
            {ROLE_LABELS[r]}
          </button>
        ))}
      </div>

      <p className="text-sm text-zinc-500 dark:text-zinc-400">{ROLE_DESCRIPTIONS[role]}</p>

      <PermissionGrid
        mode="role"
        values={draft}
        effectiveDefaults={builtIn(role)}
        readOnly={role === "ADMIN"}
        onChange={change}
      />

      {role !== "ADMIN" && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" icon={Save} loading={saving} disabled={!dirty} onClick={save}>
            Save {ROLE_LABELS[role]} permissions
          </Button>
          <Button variant="secondary" icon={RotateCcw} disabled={atDefaults || saving} onClick={resetToDefaults}>
            Reset to built-in defaults
          </Button>
          {message && (
            <p
              role={message.kind === "error" ? "alert" : "status"}
              className={cn("text-sm", message.kind === "error" ? "text-red-600" : "text-green-600 dark:text-green-400")}
            >
              {message.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
