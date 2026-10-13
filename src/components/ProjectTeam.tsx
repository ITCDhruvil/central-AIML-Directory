"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Users, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";
import { MEMBER_ROLES, MEMBER_ROLE_DESCRIPTIONS, memberRoleLabel, type MemberRole } from "@/lib/auth/membership";
import type { ProjectTeamMember } from "@/types/project";

type Draft = { userId: string; name: string; email?: string; role: MemberRole };
type Candidate = { id: string; name: string; email: string };

const ROLE_OPTIONS = MEMBER_ROLES.map((r) => ({ value: r, label: memberRoleLabel(r) }));
const ROLE_PILL: Record<MemberRole, string> = {
  OWNER: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300",
  EDIT: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
  VIEW: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
};

function Avatar({ name }: { name: string }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-50 text-xs font-semibold text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

function ManageTeamModal({
  projectId,
  initial,
  onClose,
}: {
  projectId: string;
  initial: ProjectTeamMember[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [members, setMembers] = useState<Draft[]>(initial.map((m) => ({ userId: m.userId, name: m.name, role: m.role })));
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Candidate[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchSeq = useRef(0);

  // Load emails for the current members (the list payload only carries names).
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${projectId}/team`)
      .then((r) => r.json())
      .then((body: { team?: Draft[] }) => {
        if (cancelled || !body.team) return;
        setMembers((prev) => prev.map((m) => ({ ...m, email: body.team?.find((t) => t.userId === m.userId)?.email })));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    const seq = ++searchSeq.current;
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
        const body = (await res.json()) as { users?: Candidate[] };
        if (seq === searchSeq.current) setResults(body.users ?? []);
      } catch {
        if (seq === searchSeq.current) setResults([]);
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [q]);

  const available = results.filter((u) => !members.some((m) => m.userId === u.id));
  const hasOwner = members.some((m) => m.role === "OWNER");

  function add(user: Candidate) {
    // The first person added becomes Owner so the team is valid straight away; later additions start as Contributors.
    setMembers((prev) => [...prev, { userId: user.id, name: user.name, email: user.email, role: prev.length === 0 ? "OWNER" : "EDIT" }]);
    setQ("");
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/team`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ members: members.map((m) => ({ userId: m.userId, role: m.role })) }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Failed to save the team");
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={saving ? () => undefined : onClose}
      title="Project team"
      description="Everyone here can find this project under My projects. What they can do depends on their role."
      className="max-w-2xl"
      footer={
        <>
          {error && (
            <p role="alert" className="mr-auto text-sm text-red-600">
              {error}
            </p>
          )}
          {!error && members.length > 0 && !hasOwner && (
            <p className="mr-auto text-sm text-amber-600">A team needs at least one Owner.</p>
          )}
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} disabled={members.length > 0 && !hasOwner} onClick={save}>
            Save team
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Add a person</h3>
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search people by name or email…"
              className="field h-10 w-full pl-9"
            />
          </div>
          {available.length > 0 ? (
            <ul className="mt-2 max-h-44 divide-y divide-zinc-100 overflow-y-auto rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {available.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => add(u)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                  >
                    <Avatar name={u.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{u.name}</span>
                      <span className="block truncate text-xs text-zinc-400">{u.email}</span>
                    </span>
                    <Plus size={15} className="shrink-0 text-zinc-400" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            q.trim() !== "" && <p className="mt-2 text-xs text-zinc-400">No one else matches. Only people with an account can be added.</p>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">On the team ({members.length})</h3>
          {members.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-400 dark:border-zinc-700">
              No team yet. Search above to add the first person — they become the Owner.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {members.map((m) => (
                <li key={m.userId} className="flex items-center gap-3 px-3 py-2.5">
                  <Avatar name={m.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{m.name}</p>
                    <p className="truncate text-xs text-zinc-400">{MEMBER_ROLE_DESCRIPTIONS[m.role]}</p>
                  </div>
                  <Dropdown
                    className="w-36 shrink-0"
                    value={m.role}
                    options={ROLE_OPTIONS}
                    aria-label={`Role for ${m.name}`}
                    triggerClassName="field flex h-9 w-full items-center justify-between gap-2 pr-2 text-left"
                    onChange={(value) =>
                      setMembers((prev) => prev.map((x) => (x.userId === m.userId ? { ...x, role: value as MemberRole } : x)))
                    }
                  />
                  <button
                    type="button"
                    aria-label={`Remove ${m.name}`}
                    onClick={() => setMembers((prev) => prev.filter((x) => x.userId !== m.userId))}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                  >
                    <X size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Modal>
  );
}

/** The project's team on its detail page: who is on it and in what role, with a manage button for owners and managers. */
export function ProjectTeam({
  projectId,
  team,
  legacyOwner,
  canManage,
}: {
  projectId: string;
  team: ProjectTeamMember[];
  /** The free-text lead, shown when no team has been set up yet. */
  legacyOwner: string | null;
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      {team.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {legacyOwner ? (
            <>
              No team yet. Led by <span className="font-medium text-zinc-700 dark:text-zinc-200">{legacyOwner}</span>.
            </>
          ) : (
            "No team yet."
          )}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {team.map((m) => (
            <li key={m.userId} className="flex items-center gap-2.5">
              <Avatar name={m.name} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{m.name}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", ROLE_PILL[m.role])}>{memberRoleLabel(m.role)}</span>
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <Button variant="secondary" size="sm" icon={Users} className="mt-3" onClick={() => setOpen(true)}>
          {team.length === 0 ? "Set up team" : "Manage team"}
        </Button>
      )}

      {open && <ManageTeamModal projectId={projectId} initial={team} onClose={() => setOpen(false)} />}
    </div>
  );
}
