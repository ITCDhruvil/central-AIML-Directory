"use client";

import { useState } from "react";
import {
  Activity,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  KeyRound,
  Link2,
  Pencil,
  Plus,
  Server,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/Button";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import { ENVIRONMENT_STATUSES, type EnvironmentStatus } from "@/lib/environments/validate";
import type { EnvironmentCredentialView, EnvironmentLinkView, EnvironmentView } from "@/types/environment";

const STATUS_LABEL: Record<EnvironmentStatus, string> = {
  LIVE: "Live",
  DOWN: "Down",
  NOT_DEPLOYED: "Not deployed",
  PLANNED: "Planned",
  UNKNOWN: "Unknown",
};

const STATUS_STYLE: Record<EnvironmentStatus, string> = {
  LIVE: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400",
  DOWN: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  NOT_DEPLOYED: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  PLANNED: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  UNKNOWN: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

const LINK_GROUPS = ["App", "API", "Health", "Docs", "Azure Portal"];
const ICON_BUTTON =
  "rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-zinc-200";
const REVEAL_SECONDS = 30;

type ApiResult = { environments?: EnvironmentView[]; environment?: EnvironmentView; password?: string; error?: string };

async function call(method: string, path: string, body?: unknown): Promise<ApiResult> {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as ApiResult;
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

function isHttpUrl(value: string): boolean {
  try {
    const p = new URL(value);
    return p.protocol === "http:" || p.protocol === "https:";
  } catch {
    return false;
  }
}

function EditedBy({ name, at }: { name: string | null; at: string | null }) {
  if (!at) return null;
  return (
    <span className="text-[11px] text-zinc-400" title={new Date(at).toLocaleString()}>
      {name ? `${name} · ` : ""}
      {formatRelativeTime(at)}
    </span>
  );
}

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
      {text}
      <div className="mt-1 font-normal">{children}</div>
    </label>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Environment form (add + edit)
// ---------------------------------------------------------------------------------------------------------------

type EnvForm = {
  name: string;
  isProduction: boolean;
  status: EnvironmentStatus;
  appUrl: string;
  apiUrl: string;
  healthUrl: string;
  hosting: string;
  databaseSet: string;
  version: string;
  lastDeployedAt: string;
  notes: string;
};

function toForm(e?: EnvironmentView): EnvForm {
  return {
    name: e?.name ?? "",
    isProduction: e?.isProduction ?? false,
    status: e?.status ?? "UNKNOWN",
    appUrl: e?.appUrl ?? "",
    apiUrl: e?.apiUrl ?? "",
    healthUrl: e?.healthUrl ?? "",
    hosting: e?.hosting ?? "",
    databaseSet: e?.databaseSet ?? "",
    version: e?.version ?? "",
    lastDeployedAt: e?.lastDeployedAt ? e.lastDeployedAt.slice(0, 10) : "",
    notes: e?.notes ?? "",
  };
}

function EnvironmentForm({
  initial,
  takenNames,
  onSave,
  onCancel,
}: {
  initial?: EnvironmentView;
  takenNames: string[];
  onSave: (body: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  const [f, setF] = useState<EnvForm>(() => toForm(initial));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof EnvForm>(key: K, value: EnvForm[K]) => setF((prev) => ({ ...prev, [key]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const name = f.name.trim();
    if (!name) return setError("Name is required");
    if (takenNames.some((n) => n.trim().toLowerCase() === name.toLowerCase())) {
      return setError(`An environment named "${name}" already exists`);
    }
    for (const [value, label] of [
      [f.appUrl, "App URL"],
      [f.apiUrl, "API URL"],
      [f.healthUrl, "Health-check URL"],
    ] as const) {
      if (value.trim() && !isHttpUrl(value.trim())) return setError(`${label} must be a valid http or https URL`);
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        name,
        isProduction: f.isProduction,
        status: f.status,
        appUrl: f.appUrl,
        apiUrl: f.apiUrl,
        healthUrl: f.healthUrl,
        hosting: f.hosting,
        databaseSet: f.databaseSet,
        version: f.version,
        lastDeployedAt: f.lastDeployedAt ? new Date(f.lastDeployedAt).toISOString() : null,
        notes: f.notes,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-orange-200 bg-orange-50/30 p-4 dark:border-orange-900/50 dark:bg-orange-500/5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Label text="Name">
          <input className="field w-full" value={f.name} onChange={(e) => set("name", e.target.value)} maxLength={60} placeholder="e.g. Staging" autoFocus />
        </Label>
        <Label text="Status">
          <select className="field w-full" value={f.status} onChange={(e) => set("status", e.target.value as EnvironmentStatus)}>
            {ENVIRONMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Label>
        <Label text="App URL">
          <input className="field w-full" value={f.appUrl} onChange={(e) => set("appUrl", e.target.value)} placeholder="https://app.example.com" />
        </Label>
        <Label text="API / gateway URL">
          <input className="field w-full" value={f.apiUrl} onChange={(e) => set("apiUrl", e.target.value)} placeholder="https://api.example.com" />
        </Label>
        <Label text="Health-check URL">
          <input className="field w-full" value={f.healthUrl} onChange={(e) => set("healthUrl", e.target.value)} placeholder="https://api.example.com/health" />
        </Label>
        <Label text="Hosting">
          <input className="field w-full" value={f.hosting} onChange={(e) => set("hosting", e.target.value)} placeholder="Azure Web App" />
        </Label>
        <Label text="Database set">
          <input className="field w-full" value={f.databaseSet} onChange={(e) => set("databaseSet", e.target.value)} />
        </Label>
        <Label text="Version / image tag">
          <input className="field w-full" value={f.version} onChange={(e) => set("version", e.target.value)} />
        </Label>
        <Label text="Last deployed">
          <input type="date" className="field w-full" value={f.lastDeployedAt} onChange={(e) => set("lastDeployedAt", e.target.value)} />
        </Label>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input type="checkbox" checked={f.isProduction} onChange={(e) => set("isProduction", e.target.checked)} />
          Production (no test users or passwords)
        </label>
      </div>
      <Label text="Notes">
        <textarea className="field w-full" rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
      </Label>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" loading={saving}>
          Save
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------------------------------------------

function LinkForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: EnvironmentLinkView;
  onSave: (body: { label: string; url: string; group: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [group, setGroup] = useState(initial?.group ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return setError("Label is required");
    if (!isHttpUrl(url.trim())) return setError("URL must be a valid http or https URL");
    setSaving(true);
    setError("");
    try {
      await onSave({ label: label.trim(), url: url.trim(), group: group.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_2fr_1fr]">
        <input className="field w-full" placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} autoFocus />
        <input className="field w-full" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
        <input className="field w-full" placeholder="Group (optional)" list="env-link-groups" value={group} onChange={(e) => setGroup(e.target.value)} maxLength={80} />
        <datalist id="env-link-groups">
          {LINK_GROUPS.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" loading={saving}>
          Save
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Test accounts
// ---------------------------------------------------------------------------------------------------------------

function CredentialForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: EnvironmentCredentialView;
  onSave: (body: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  const [purpose, setPurpose] = useState(initial?.purpose ?? "");
  const [username, setUsername] = useState(initial?.username ?? "");
  const [password, setPassword] = useState("");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!purpose.trim()) return setError("Role or purpose is required");
    if (!username.trim()) return setError("Username is required");
    setSaving(true);
    setError("");
    try {
      // On edit an empty password box means "keep the stored one", so it is left out of the request.
      await onSave({ purpose, username, notes, ...(password ? { password } : {}) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} autoComplete="off" className="space-y-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input className="field w-full" placeholder="Role or purpose (e.g. admin)" value={purpose} onChange={(e) => setPurpose(e.target.value)} maxLength={80} autoFocus />
        <input className="field w-full" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />
        <input
          className="field w-full"
          type="password"
          placeholder={initial?.hasPassword ? "New password (leave empty to keep)" : "Password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        <input className="field w-full" placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" loading={saving}>
          Save
        </Button>
      </div>
    </form>
  );
}

function CredentialRow({
  cred,
  canEdit,
  base,
  onEdit,
  onDelete,
}: {
  cred: EnvironmentCredentialView;
  canEdit: boolean;
  base: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [shown, setShown] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  // The password only exists in this component's state, for a short time after Reveal; it is never put in storage.
  async function fetchPassword(): Promise<string | null> {
    setBusy(true);
    setError("");
    try {
      return (await call("POST", `${base}/credentials/${cred.id}/reveal`)).password ?? null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reveal");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function reveal() {
    const pw = await fetchPassword();
    if (pw === null) return;
    setShown(pw);
    window.setTimeout(() => setShown(null), REVEAL_SECONDS * 1000);
  }

  async function copy() {
    const pw = shown ?? (await fetchPassword());
    if (pw === null) return;
    try {
      await navigator.clipboard.writeText(pw);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Could not copy to the clipboard");
    }
  }

  return (
    <tr className="border-t border-zinc-100 align-top dark:border-zinc-800">
      <td className="py-2 pr-3 text-sm text-zinc-800 dark:text-zinc-200">{cred.purpose}</td>
      <td className="py-2 pr-3 font-mono text-xs text-zinc-700 dark:text-zinc-300">{cred.username}</td>
      <td className="py-2 pr-3">
        {!cred.hasPassword ? (
          <span className="text-xs text-zinc-400">Not set</span>
        ) : !canEdit ? (
          <span className="text-xs text-zinc-400" title="Only people who can edit this project can see passwords">
            ••••••••
          </span>
        ) : (
          <div className="flex items-center gap-1">
            <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300">{shown ?? "••••••••"}</span>
            <button type="button" className={ICON_BUTTON} onClick={shown ? () => setShown(null) : reveal} disabled={busy} aria-label={shown ? "Hide password" : "Reveal password"} title={shown ? "Hide" : "Reveal"}>
              {shown ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            <button type="button" className={ICON_BUTTON} onClick={copy} disabled={busy} aria-label="Copy password" title="Copy">
              {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
            </button>
          </div>
        )}
        {error && <p className="text-[11px] text-red-600">{error}</p>}
        {cred.hasPassword && <EditedBy name={cred.passwordUpdatedByName} at={cred.passwordUpdatedAt} />}
      </td>
      <td className="py-2 pr-3 text-xs text-zinc-500">
        {cred.notes}
        <div>
          <EditedBy name={cred.updatedByName} at={cred.updatedAt} />
        </div>
      </td>
      <td className="py-2 text-right">
        {canEdit && (
          <div className="flex justify-end">
            <button type="button" className={ICON_BUTTON} onClick={onEdit} aria-label="Edit test account" title="Edit">
              <Pencil size={14} />
            </button>
            <button type="button" className={ICON_BUTTON} onClick={onDelete} aria-label="Delete test account" title="Delete">
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// One environment card
// ---------------------------------------------------------------------------------------------------------------

type Editing = null | "env" | "newLink" | "newCred" | { link: string } | { cred: string };

function EnvironmentCard({
  env,
  projectId,
  canEdit,
  isFirst,
  isLast,
  takenNames,
  run,
  onMove,
}: {
  env: EnvironmentView;
  projectId: string;
  canEdit: boolean;
  isFirst: boolean;
  isLast: boolean;
  takenNames: string[];
  run: (fn: () => Promise<ApiResult>) => Promise<void>;
  onMove: (direction: -1 | 1) => void;
}) {
  const base = `/api/projects/${projectId}/environments/${env.id}`;
  const [editing, setEditing] = useState<Editing>(null);
  const [confirm, setConfirm] = useState<null | { kind: "env" } | { kind: "link"; id: string } | { kind: "cred"; id: string }>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [pinging, setPinging] = useState(false);

  const mainUrl = env.appUrl ?? env.apiUrl;
  const details: [string, string | null][] = [
    ["App URL", env.appUrl],
    ["API / gateway URL", env.apiUrl],
    ["Health check", env.healthUrl],
    ["Hosting", env.hosting],
    ["Database set", env.databaseSet],
    ["Version / tag", env.version],
    ["Last deployed", env.lastDeployedAt ? new Date(env.lastDeployedAt).toLocaleDateString() : null],
  ];

  async function copyUrl() {
    if (!mainUrl) return;
    try {
      await navigator.clipboard.writeText(mainUrl);
      setCopiedUrl(true);
      window.setTimeout(() => setCopiedUrl(false), 1500);
    } catch {
      // clipboard blocked: nothing useful to do
    }
  }

  async function ping() {
    setPinging(true);
    await run(() => call("POST", `${base}/ping`)).catch(() => {});
    setPinging(false);
  }

  const grouped = [...new Set(env.links.map((l) => l.group ?? ""))];

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      {editing === "env" ? (
        <EnvironmentForm
          initial={env}
          takenNames={takenNames.filter((n) => n !== env.name)}
          onCancel={() => setEditing(null)}
          onSave={async (body) => {
            await run(() => call("PUT", base, body));
            setEditing(null);
          }}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Server size={16} className="text-zinc-400" />
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{env.name}</h3>
            <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_STYLE[env.status]}`}>{STATUS_LABEL[env.status]}</span>
            {env.isProduction && (
              <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                <ShieldAlert size={12} /> Production
              </span>
            )}
            <div className="ml-auto flex items-center">
              {mainUrl && (
                <>
                  <Button href={mainUrl} external icon={ExternalLink} variant="secondary" size="sm" className="mr-1">
                    Open app
                  </Button>
                  <button type="button" className={ICON_BUTTON} onClick={copyUrl} aria-label="Copy URL" title="Copy URL">
                    {copiedUrl ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                  </button>
                </>
              )}
              {env.healthUrl && (
                <a href={env.healthUrl} target="_blank" rel="noopener noreferrer" className={ICON_BUTTON} aria-label="Open health check" title="Open health check">
                  <Activity size={14} />
                </a>
              )}
              {canEdit && (
                <>
                  {env.healthUrl && (
                    <Button variant="ghost" size="sm" onClick={ping} loading={pinging}>
                      Ping
                    </Button>
                  )}
                  <button type="button" className={ICON_BUTTON} disabled={isFirst} onClick={() => onMove(-1)} aria-label="Move up" title="Move up">
                    <ChevronUp size={14} />
                  </button>
                  <button type="button" className={ICON_BUTTON} disabled={isLast} onClick={() => onMove(1)} aria-label="Move down" title="Move down">
                    <ChevronDown size={14} />
                  </button>
                  <button type="button" className={ICON_BUTTON} onClick={() => setEditing("env")} aria-label="Edit environment" title="Edit">
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    className={ICON_BUTTON}
                    aria-label="Duplicate environment"
                    title="Duplicate (without test accounts)"
                    onClick={() => {
                      const name = window.prompt(`Name for the copy of ${env.name}:`, `${env.name} copy`)?.trim();
                      if (name) run(() => call("POST", `/api/projects/${projectId}/environments`, { duplicateFrom: env.id, name })).catch(() => {});
                    }}
                  >
                    <Copy size={14} />
                  </button>
                  <button type="button" className={ICON_BUTTON} onClick={() => setConfirm({ kind: "env" })} aria-label="Delete environment" title="Delete">
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          </div>

          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            {details
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <dt className="w-32 shrink-0 text-zinc-500 dark:text-zinc-400">{k}</dt>
                  <dd className="min-w-0 break-words text-zinc-800 dark:text-zinc-200">{v}</dd>
                </div>
              ))}
          </dl>
          {env.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-300">{env.notes}</p>}
          <div className="mt-1 flex flex-wrap gap-x-3">
            <EditedBy name={env.updatedByName} at={env.updatedAt} />
            {env.lastCheckedAt && <span className="text-[11px] text-zinc-400">Health checked {formatRelativeTime(env.lastCheckedAt)}</span>}
          </div>
        </>
      )}

      {/* Links */}
      <div className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <Link2 size={13} /> Links
          </h4>
          {canEdit && editing !== "newLink" && (
            <Button variant="ghost" size="sm" icon={Plus} onClick={() => setEditing("newLink")}>
              Add link
            </Button>
          )}
        </div>
        {env.links.length === 0 && editing !== "newLink" && <p className="mt-1 text-xs text-zinc-400">No links yet.</p>}
        <div className="mt-2 space-y-2">
          {grouped.map((g) => (
            <div key={g || "none"}>
              {g && <p className="mb-1 text-[11px] font-medium text-zinc-400">{g}</p>}
              <ul className="space-y-1">
                {env.links
                  .filter((l) => (l.group ?? "") === g)
                  .map((l) =>
                    typeof editing === "object" && editing && "link" in editing && editing.link === l.id ? (
                      <li key={l.id}>
                        <LinkForm
                          initial={l}
                          onCancel={() => setEditing(null)}
                          onSave={async (body) => {
                            await run(() => call("PUT", `${base}/links/${l.id}`, body));
                            setEditing(null);
                          }}
                        />
                      </li>
                    ) : (
                      <li key={l.id} className="flex items-center gap-2 text-sm">
                        <a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-1.5 text-orange-600 hover:underline dark:text-orange-400">
                          <ExternalLink size={12} className="shrink-0" />
                          <span className="truncate">{l.label}</span>
                        </a>
                        <span className="hidden min-w-0 truncate text-xs text-zinc-400 sm:inline">{l.url}</span>
                        {canEdit && (
                          <span className="ml-auto flex shrink-0">
                            <button type="button" className={ICON_BUTTON} onClick={() => setEditing({ link: l.id })} aria-label="Edit link" title="Edit">
                              <Pencil size={13} />
                            </button>
                            <button type="button" className={ICON_BUTTON} onClick={() => setConfirm({ kind: "link", id: l.id })} aria-label="Delete link" title="Delete">
                              <Trash2 size={13} />
                            </button>
                          </span>
                        )}
                      </li>
                    ),
                  )}
              </ul>
            </div>
          ))}
        </div>
        {editing === "newLink" && (
          <div className="mt-2">
            <LinkForm
              onCancel={() => setEditing(null)}
              onSave={async (body) => {
                await run(() => call("POST", `${base}/links`, body));
                setEditing(null);
              }}
            />
          </div>
        )}
      </div>

      {/* Test accounts: never offered for a Production environment */}
      <div className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <KeyRound size={13} /> Test users
          </h4>
          {canEdit && !env.isProduction && editing !== "newCred" && (
            <Button variant="ghost" size="sm" icon={Plus} onClick={() => setEditing("newCred")}>
              Add test user
            </Button>
          )}
        </div>
        {env.isProduction ? (
          <p className="mt-1 text-xs text-zinc-400">Production environments never store test users or passwords.</p>
        ) : (
          <>
            {env.credentials.length === 0 && editing !== "newCred" && <p className="mt-1 text-xs text-zinc-400">No test users yet.</p>}
            {env.credentials.length > 0 && (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[34rem] text-left">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wide text-zinc-400">
                      <th className="pb-1 pr-3 font-medium">Role / purpose</th>
                      <th className="pb-1 pr-3 font-medium">Username</th>
                      <th className="pb-1 pr-3 font-medium">Password</th>
                      <th className="pb-1 pr-3 font-medium">Notes</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {env.credentials.map((c) =>
                      typeof editing === "object" && editing && "cred" in editing && editing.cred === c.id ? (
                        <tr key={c.id}>
                          <td colSpan={5} className="py-2">
                            <CredentialForm
                              initial={c}
                              onCancel={() => setEditing(null)}
                              onSave={async (body) => {
                                await run(() => call("PUT", `${base}/credentials/${c.id}`, body));
                                setEditing(null);
                              }}
                            />
                          </td>
                        </tr>
                      ) : (
                        <CredentialRow key={c.id} cred={c} canEdit={canEdit} base={base} onEdit={() => setEditing({ cred: c.id })} onDelete={() => setConfirm({ kind: "cred", id: c.id })} />
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {editing === "newCred" && (
              <div className="mt-2">
                <CredentialForm
                  onCancel={() => setEditing(null)}
                  onSave={async (body) => {
                    await run(() => call("POST", `${base}/credentials`, body));
                    setEditing(null);
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.kind === "env" ? `Delete ${env.name}?` : confirm?.kind === "link" ? "Delete this link?" : "Delete this test user?"}
        description={
          confirm?.kind === "env"
            ? "This removes the environment with all of its links and test users. It cannot be undone."
            : "This cannot be undone."
        }
        confirmLabel="Delete"
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          const c = confirm;
          setConfirm(null);
          if (!c) return;
          const request =
            c.kind === "env"
              ? () => call("DELETE", base)
              : c.kind === "link"
                ? () => call("DELETE", `${base}/links/${c.id}`)
                : () => call("DELETE", `${base}/credentials/${c.id}`);
          await run(request).catch(() => {});
        }}
      />
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------------------------------------------

export function ProjectEnvironments({
  projectId,
  initial,
  canEdit,
}: {
  projectId: string;
  initial: EnvironmentView[];
  canEdit: boolean;
}) {
  const [envs, setEnvs] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const apiBase = `/api/projects/${projectId}/environments`;

  /** Runs a request and folds the answer into the list; errors show in the banner instead of being lost. */
  async function run(fn: () => Promise<ApiResult>): Promise<void> {
    setError("");
    try {
      const data = await fn();
      if (data.environments) setEnvs(data.environments);
      else if (data.environment) {
        const updated = data.environment;
        setEnvs((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      throw err;
    }
  }

  // Card callbacks await run() inside forms (which show the error themselves); this variant just swallows it.
  const safeRun = async (fn: () => Promise<ApiResult>) => {
    try {
      await run(fn);
    } catch {
      // already shown in the banner
    }
  };

  function move(index: number, direction: -1 | 1) {
    const ids = envs.map((e) => e.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void safeRun(() => call("PATCH", apiBase, { ids }));
  }

  const takenNames = envs.map((e) => e.name);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Where this project runs, how to reach it, and the test accounts to use. Production never stores test users.
        </p>
        <div className="flex items-center gap-2">
          {envs.length > 0 && (
            <>
              <Button href={`${apiBase}/export?format=json`} external icon={Download} variant="secondary" size="sm">
                JSON
              </Button>
              <Button href={`${apiBase}/export?format=csv`} external icon={Download} variant="secondary" size="sm">
                CSV
              </Button>
            </>
          )}
          {canEdit && !adding && (
            <Button variant="primary" size="sm" icon={Plus} onClick={() => setAdding(true)}>
              Add environment
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-500/10 dark:text-red-400">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}

      {adding && (
        <EnvironmentForm
          takenNames={takenNames}
          onCancel={() => setAdding(false)}
          onSave={async (body) => {
            await run(() => call("POST", apiBase, body));
            setAdding(false);
          }}
        />
      )}

      {envs.length === 0 && !adding ? (
        <div className="flex flex-col items-center gap-3">
          <EmptyState
            icon={Server}
            title="No environments yet"
            description={canEdit ? "Start with DEV, QA, UAT and PROD, or add your own." : "Nobody has added environments to this project yet."}
          />
          {canEdit && (
            <Button variant="primary" onClick={() => safeRun(() => call("POST", apiBase, { defaults: true }))}>
              Add DEV, QA, UAT, PROD
            </Button>
          )}
        </div>
      ) : (
        envs.map((env, i) => (
          <EnvironmentCard
            key={env.id}
            env={env}
            projectId={projectId}
            canEdit={canEdit}
            isFirst={i === 0}
            isLast={i === envs.length - 1}
            takenNames={takenNames}
            run={run}
            onMove={(d) => move(i, d)}
          />
        ))
      )}
    </div>
  );
}
