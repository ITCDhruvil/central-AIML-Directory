"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileJson, FileSpreadsheet, Trash2 } from "lucide-react";
import { useBranding } from "@/components/BrandingProvider";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { Button } from "@/components/ui/Button";
import { BRANDING_LIMITS, DEFAULT_BRANDING } from "@/lib/branding";
import { cn } from "@/lib/cn";

type OwnerUsage = {
  id: string;
  name: string;
  projects: number;
  ideas: number;
  linkedUser: string | null;
};

const inputClass =
  "h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition-colors focus:border-orange-500 focus:ring-4 focus:ring-orange-500/15 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";

const EXPORTS = [
  {
    type: "projects",
    label: "Projects",
    hint: "Every project as a spreadsheet",
    icon: FileSpreadsheet,
  },
  {
    type: "ideas",
    label: "Ideas",
    hint: "Every idea as a spreadsheet",
    icon: FileSpreadsheet,
  },
  {
    type: "owners",
    label: "Owner names",
    hint: "The owner list and linked accounts",
    icon: FileSpreadsheet,
  },
  {
    type: "backup",
    label: "Full backup",
    hint: "Projects, ideas and owners as JSON",
    icon: FileJson,
  },
] as const;

function Branding() {
  const router = useRouter();
  const saved = useBranding();
  const [name, setName] = useState(saved.appName);
  const [tagline, setTagline] = useState(saved.tagline);
  const [base, setBase] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);

  const dirty = name.trim() !== base.appName || tagline.trim() !== base.tagline;
  const atDefaults =
    name === DEFAULT_BRANDING.appName && tagline === DEFAULT_BRANDING.tagline;

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branding: { appName: name, tagline } }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        branding?: typeof saved;
      };
      if (!res.ok || !body.branding) {
        setMessage({ kind: "error", text: body.error ?? "Failed to save" });
        return;
      }
      setName(body.branding.appName);
      setTagline(body.branding.tagline);
      setBase(body.branding);
      setMessage({ kind: "ok", text: "Saved." });
      router.refresh(); // the sidebar, sign-in page and tab title read the name from the server
    } catch {
      setMessage({ kind: "error", text: "Network error — please try again" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsCard
      className="h-full"
      title="Workspace name"
      description="Shown on the sign-in page, in the sidebar and top bar, and in the browser tab."
    >
      <div className="max-w-xl space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="brand-name"
            className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
          >
            Name
          </label>
          <input
            id="brand-name"
            value={name}
            maxLength={BRANDING_LIMITS.appName.max}
            onChange={(e) => {
              setName(e.target.value);
              setMessage(null);
            }}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor="brand-tagline"
            className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
          >
            Tagline{" "}
            <span className="font-normal text-zinc-400">(optional)</span>
          </label>
          <input
            id="brand-tagline"
            value={tagline}
            maxLength={BRANDING_LIMITS.tagline.max}
            onChange={(e) => {
              setTagline(e.target.value);
              setMessage(null);
            }}
            className={inputClass}
          />
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="leading-tight">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {name.trim() || "—"}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {tagline.trim() || " "}
            </p>
          </div>
          <span className="ml-auto text-[11px] uppercase tracking-wide text-zinc-400">
            Preview
          </span>
        </div>

        {message && (
          <p
            role={message.kind === "error" ? "alert" : "status"}
            className={cn(
              "text-sm",
              message.kind === "error"
                ? "text-red-600 dark:text-red-400"
                : "text-emerald-600 dark:text-emerald-400",
            )}
          >
            {message.text}
          </p>
        )}
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            loading={saving}
            disabled={!dirty || !name.trim()}
            onClick={() => void save()}
          >
            Save changes
          </Button>
          <Button
            variant="ghost"
            disabled={atDefaults || saving}
            onClick={() => {
              setName(DEFAULT_BRANDING.appName);
              setTagline(DEFAULT_BRANDING.tagline);
              setMessage(null);
            }}
          >
            Reset to default
          </Button>
        </div>
      </div>
    </SettingsCard>
  );
}

function Exports() {
  return (
    <SettingsCard
      className="h-full"
      title="Export data"
      description="Download a copy of the directory. Passwords and accounts are never included, and each download is recorded in the audit log."
    >
      <ul className="grid gap-3 sm:grid-cols-2">
        {EXPORTS.map(({ type, label, hint, icon: Icon }) => (
          <li key={type}>
            <a
              href={`/api/admin/data/export?type=${type}`}
              className="flex items-center gap-3 rounded-lg border border-zinc-200 p-3 transition-colors hover:border-orange-300 hover:bg-orange-50/40 dark:border-zinc-800 dark:hover:border-orange-500/40 dark:hover:bg-orange-500/5"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-500/15">
                <Icon size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {label}
                </span>
                <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                  {hint}
                </span>
              </span>
              <Download size={16} className="shrink-0 text-zinc-400" />
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
        Importing is not available here yet. Use the full backup to keep a safe
        copy before large changes.
      </p>
    </SettingsCard>
  );
}

function OwnerCleanup() {
  const [owners, setOwners] = useState<OwnerUsage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<OwnerUsage | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/data/owners")
      .then((r) => r.json().then((body) => ({ ok: r.ok, body })))
      .then(({ ok, body }) => {
        if (cancelled) return;
        if (!ok)
          return setError(
            (body as { error?: string }).error ?? "Failed to load owner names",
          );
        setOwners((body as { owners: OwnerUsage[] }).owners);
      })
      .catch(() => !cancelled && setError("Network error — please try again"));
    return () => {
      cancelled = true;
    };
  }, []);

  async function remove() {
    if (!target) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/owners/${target.id}`, { method: "DELETE" });
      if (res.ok)
        setOwners((prev) => prev?.filter((o) => o.id !== target.id) ?? null);
      else setError("Could not remove that name.");
    } catch {
      setError("Network error — please try again");
    } finally {
      setRemoving(false);
      setTarget(null);
    }
  }

  const unused =
    owners?.filter((o) => o.projects === 0 && o.ideas === 0 && !o.linkedUser)
      .length ?? 0;

  return (
    <SettingsCard
      title="Owner names"
      description="The names offered when assigning an owner. Remove ones that are misspelled or no longer used."
    >
      {error && (
        <p role="alert" className="mb-3 text-sm text-red-600">
          {error}
        </p>
      )}
      {!owners ? (
        !error && <p className="text-sm text-zinc-500">Loading…</p>
      ) : owners.length === 0 ? (
        <p className="text-sm text-zinc-500">No owner names yet.</p>
      ) : (
        <>
          <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
            {owners.length} {owners.length === 1 ? "name" : "names"}
            {unused > 0 ? ` · ${unused} not used anywhere` : ""}
          </p>
          <div className="max-h-96 overflow-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="sticky top-0 bg-white text-left text-xs text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="py-2 pr-3 font-medium">Name</th>
                  <th className="px-3 py-2 text-right font-medium">Projects</th>
                  <th className="px-3 py-2 text-right font-medium">Ideas</th>
                  <th className="px-3 py-2 font-medium">Account</th>
                  <th className="w-10 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {owners.map((o) => {
                  const isUnused =
                    o.projects === 0 && o.ideas === 0 && !o.linkedUser;
                  return (
                    <tr key={o.id}>
                      <td className="py-2 pr-3 font-medium text-zinc-800 dark:text-zinc-200">
                        {o.name}
                        {isUnused && (
                          <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                            Unused
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-300">
                        {o.projects}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-300">
                        {o.ideas}
                      </td>
                      <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300">
                        {o.linkedUser ?? "—"}
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => setTarget(o)}
                          aria-label={`Remove ${o.name}`}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ConfirmDialog
        open={target !== null}
        title={`Remove “${target?.name ?? ""}”?`}
        description={
          target && (target.projects > 0 || target.ideas > 0)
            ? `${target.projects} project(s) and ${target.ideas} idea(s) mention this name. They keep their text; only the name is removed from the list of choices.`
            : "Nothing uses this name, so removing it only tidies the list."
        }
        confirmLabel="Remove"
        loading={removing}
        onConfirm={() => void remove()}
        onCancel={() => setTarget(null)}
      />
    </SettingsCard>
  );
}

export function GeneralSettings() {
  return (
    <div className="space-y-6">
      {/* items-stretch + h-full on the cards: both end at the height of the taller one. */}
      <div className="grid items-stretch gap-6 xl:grid-cols-2">
        <Branding />
        <Exports />
      </div>
      <OwnerCleanup />
    </div>
  );
}
