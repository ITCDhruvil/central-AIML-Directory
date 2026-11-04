"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bookmark,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Clock,
  Copy,
  Database,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  FlaskConical,
  Globe,
  Info,
  Laptop,
  Link2,
  LogIn,
  MoreVertical,
  Pencil,
  Plus,
  Rocket,
  Server,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  User,
  X,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/Button";
import { Dropdown, type DropdownOption } from "@/components/ui/Dropdown";
import { IconPicker, RoleIcon } from "@/components/RoleIcon";
import { Loader } from "@/components/prompt-kit/loader";
import { TextShimmer } from "@/components/prompt-kit/text-shimmer";
import { FILL_BOOKMARKLET, fillPayload } from "@/lib/fillBookmarklet";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import { useClickOutside } from "@/lib/useClickOutside";
import { ENVIRONMENT_STATUSES, type EnvironmentStatus } from "@/lib/environments/validate";
import type { EnvironmentCredentialView, EnvironmentLinkView, EnvironmentView } from "@/types/environment";

export const STATUS_LABEL: Record<EnvironmentStatus, string> = {
  LIVE: "Live",
  DOWN: "Down",
  NOT_DEPLOYED: "Not deployed",
  PLANNED: "Planned",
  UNKNOWN: "Unknown",
};

export const STATUS_STYLE: Record<EnvironmentStatus, string> = {
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
// Shown blurred in place of a hidden password. It is not the password, just text of a similar size to blur.
const BLURRED_SAMPLE = "p4ssw0rd!x9";

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
    <span className="text-[11px] text-zinc-400" title={new Date(at).toLocaleString()} suppressHydrationWarning>
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
    <form onSubmit={submit} className="space-y-3 rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/50">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_2fr_1fr]">
        <Label text="Label">
          <input className="field w-full" placeholder="e.g. Swagger" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} autoFocus />
        </Label>
        <Label text="URL">
          <input className="field w-full" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
        </Label>
        <Label text="Group (optional)">
          <input className="field w-full" placeholder="Docs, Azure Portal…" list="env-link-groups" value={group} onChange={(e) => setGroup(e.target.value)} maxLength={80} />
        </Label>
        <datalist id="env-link-groups">
          {LINK_GROUPS.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" loading={saving}>
          Save link
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Test accounts
// ---------------------------------------------------------------------------------------------------------------

const CUSTOM_ROLE = "__custom__";
const BASE_ROLES = ["Admin", "Non-admin"];

type KnownRole = { purpose: string; icon: string | null };

function CredentialForm({
  initial,
  knownRoles,
  onSave,
  onCancel,
}: {
  initial?: EnvironmentCredentialView;
  /** Roles already used by test users elsewhere in this project (with their icons), offered again so they only have to be set up once. */
  knownRoles: KnownRole[];
  onSave: (body: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  const [purpose, setPurpose] = useState(initial?.purpose ?? "");
  const [icon, setIcon] = useState<string | null>(initial?.icon ?? null);

  // Admin and Non-admin first, then any custom roles already in use (case-insensitive, listed once).
  const roles = useMemo(() => {
    const seen = new Set<string>();
    return [...BASE_ROLES, ...knownRoles.map((k) => k.purpose)].filter((r) => {
      const key = r.trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [knownRoles]);
  const iconOfRole = (role: string) => knownRoles.find((k) => k.icon && k.purpose.toLowerCase() === role.toLowerCase())?.icon ?? null;
  const matchedRole = roles.find((r) => r.toLowerCase() === purpose.trim().toLowerCase());
  // A role that isn't in the list (or "Custom…" being chosen) swaps the dropdown for a text box with an icon picker.
  const [custom, setCustom] = useState(Boolean(initial?.purpose) && !roles.some((r) => r.toLowerCase() === initial?.purpose.trim().toLowerCase()));
  const roleOptions: DropdownOption[] = [
    ...roles.map((r) => ({ value: r, label: r, icon: r === "Admin" ? ShieldCheck : User })),
    { value: CUSTOM_ROLE, label: "Custom…", icon: Plus },
  ];
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
      await onSave({ purpose, icon, username, notes, ...(password ? { password } : {}) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} autoComplete="off" className="space-y-3 rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/50">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* A div, not a label: the icon picker inside has its own inputs and buttons. */}
        <div className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Role or purpose
          <div className="mt-1 font-normal">
            {custom ? (
              <div className="relative">
                <input
                  className="field w-full pr-[4.25rem]"
                  placeholder="Custom role, e.g. tester"
                  aria-label="Custom role"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  maxLength={80}
                  autoFocus
                />
                <div className="absolute inset-y-0 right-1.5 flex items-center gap-0.5">
                  <IconPicker value={icon} roleText={purpose} onChange={setIcon} />
                  <button
                    type="button"
                    aria-label="Choose from the list instead"
                    title="Choose from the list"
                    onClick={() => {
                      setCustom(false);
                      setPurpose("");
                      setIcon(null);
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>
            ) : (
              <Dropdown
                value={matchedRole ?? ""}
                options={roleOptions}
                placeholder="Select a role"
                aria-label="Role or purpose"
                className="w-full"
                onChange={(value) => {
                  if (value === CUSTOM_ROLE) {
                    setCustom(true);
                    setPurpose("");
                    setIcon(null);
                  } else {
                    setPurpose(value);
                    setIcon(iconOfRole(value));
                  }
                }}
              />
            )}
          </div>
        </div>
        <Label text="Username">
          <input className="field w-full" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />
        </Label>
        <Label text={initial?.hasPassword ? "New password (leave empty to keep the current one)" : "Password"}>
          <input className="field w-full" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </Label>
        <Label text="Notes (optional)">
          <input className="field w-full" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Label>
      </div>
      <p className="text-[11px] text-zinc-400">Passwords are stored encrypted and only shown to people who can edit this project.</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" loading={saving}>
          Save test user
        </Button>
      </div>
    </form>
  );
}

function CredentialItem({
  cred,
  canEdit,
  base,
  openUrl,
  onEdit,
  onDelete,
}: {
  cred: EnvironmentCredentialView;
  canEdit: boolean;
  base: string;
  /** The environment's app address, opened by "Login & open". */
  openUrl: string | null;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [shown, setShown] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  // Only "Login & open" shows its own spinner; Reveal and Copy use `busy`, which just disables their icons.
  const [opening, setOpening] = useState(false);

  // The password only exists in this component's state, for a short time after Reveal; it is never put in storage.
  async function fetchPassword(): Promise<string | null> {
    setError("");
    try {
      return (await call("POST", `${base}/credentials/${cred.id}/reveal`)).password ?? null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reveal");
      return null;
    }
  }

  // `busy` is only the eye icon's "Decrypting…" state; Login & open has its own (`opening`) and doesn't touch it.
  async function reveal() {
    setBusy(true);
    try {
      const [pw] = await Promise.all([fetchPassword(), new Promise((resolve) => window.setTimeout(resolve, 450))]);
      if (pw === null) return;
      setShown(pw);
      window.setTimeout(() => setShown(null), REVEAL_SECONDS * 1000);
    } finally {
      setBusy(false);
    }
  }

  // Copy only works on a password that has been revealed; while it is blurred there is nothing to copy.
  async function copy() {
    if (shown === null) return;
    try {
      await navigator.clipboard.writeText(shown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Could not copy to the clipboard");
    }
  }

  // We can't type into another site's page, so this copies the login (an audited Reveal) and opens the app; the
  // one-time "Fill login" bookmark then fills the form from the clipboard. The tab is opened after the copy because a
  // new tab takes the focus the clipboard needs.
  async function loginAndOpen() {
    setOpening(true);
    try {
      const pw = shown ?? (await fetchPassword());
      if (pw === null || !openUrl) return;
      try {
        await navigator.clipboard.writeText(fillPayload(cred.username, pw));
      } catch {
        setError("Could not copy to the clipboard");
        return;
      }
      window.open(openUrl, "_blank", "noopener,noreferrer");
      setNote("Login copied. On the login page, click your “Fill login” bookmark (set it up with the Login fill button at the top).");
      window.setTimeout(() => setNote(""), 15000);
    } finally {
      setOpening(false);
    }
  }

  return (
    <li className="group rounded-xl bg-zinc-50 px-4 py-3 dark:bg-zinc-800/50">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-1 basis-52 items-center gap-3">
          <RoleIcon icon={cred.icon} purpose={cred.purpose} size={20} className="shrink-0 text-zinc-500 dark:text-zinc-400" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{cred.purpose}</p>
            {cred.notes && <p className="truncate text-xs text-zinc-400" title={cred.notes}>{cred.notes}</p>}
          </div>
        </div>

        <div className="min-w-0 basis-48">
          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Username</p>
          <div className="mt-0.5 flex items-center gap-1">
            <span className="min-w-0 truncate font-mono text-sm text-zinc-800 dark:text-zinc-100">{cred.username}</span>
            <CopyButton text={cred.username} label="Copy username" />
          </div>
        </div>

        <div className="min-w-0 basis-48">
          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Password</p>
          <div className="mt-0.5 flex min-h-[1.75rem] items-center gap-1">
            {!cred.hasPassword ? (
              <span className="text-sm text-zinc-400">Not set</span>
            ) : !canEdit ? (
              <span className="select-none font-mono text-sm text-zinc-500 blur-[5px]" title="Only people who can edit this project can see passwords" aria-label="Hidden password">
                {BLURRED_SAMPLE}
              </span>
            ) : (
              <>
                {shown !== null ? (
                  <span className="min-w-0 truncate font-mono text-sm text-zinc-800 dark:text-zinc-100">{shown}</span>
                ) : busy ? (
                  <span role="status" className="min-w-0 truncate">
                    <TextShimmer className="font-mono text-sm">Decrypting…</TextShimmer>
                  </span>
                ) : (
                  // Stand-in text, blurred. The real password is never in the page until Reveal fetches it.
                  <button
                    type="button"
                    onClick={reveal}
                    disabled={busy || opening}
                    title="Click to reveal"
                    aria-label="Reveal password"
                    className="min-w-0 cursor-pointer select-none truncate font-mono text-sm text-zinc-700 blur-[5px] transition hover:blur-[4px] dark:text-zinc-200"
                    onCopy={(e) => e.preventDefault()}
                  >
                    {BLURRED_SAMPLE}
                  </button>
                )}
                <button type="button" className={ICON_BUTTON} onClick={shown ? () => setShown(null) : reveal} disabled={busy || opening} aria-label={shown ? "Hide password" : "Reveal password"} title={shown ? "Hide" : "Reveal"}>
                  {busy && shown === null ? <Loader size={14} /> : shown ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                {copied ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400" role="status">
                    <Check size={13} /> Copied!
                  </span>
                ) : (
                  <button
                    type="button"
                    className={ICON_BUTTON}
                    onClick={copy}
                    disabled={shown === null}
                    aria-label="Copy password"
                    title={shown === null ? "Reveal the password first to copy it" : "Copy password"}
                  >
                    <Copy size={14} />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {canEdit && openUrl && cred.hasPassword && (
          <Button variant="secondary" size="sm" icon={LogIn} onClick={loginAndOpen} loading={opening} className="rounded-lg" title="Copy the password and open the app">
            Login &amp; open
          </Button>
        )}

        {canEdit && (
          <div className="ml-auto flex items-center transition sm:opacity-0 sm:focus-within:opacity-100 sm:group-hover:opacity-100">
            <button type="button" className={ICON_BUTTON} onClick={onEdit} aria-label="Edit test user" title="Edit">
              <Pencil size={14} />
            </button>
            <button type="button" className={ICON_BUTTON} onClick={onDelete} aria-label="Delete test user" title="Delete">
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {note && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400" role="status">
          <Check size={13} /> {note}
        </p>
      )}
      {cred.hasPassword && cred.passwordUpdatedAt && (
        <p className="mt-2 text-[11px] text-zinc-400">
          Password changed <EditedBy name={cred.passwordUpdatedByName} at={cred.passwordUpdatedAt} />
        </p>
      )}
    </li>
  );
}

export const STATUS_DOT: Record<EnvironmentStatus, string> = {
  LIVE: "bg-green-500",
  DOWN: "bg-red-500",
  PLANNED: "bg-blue-400",
  NOT_DEPLOYED: "bg-zinc-400",
  UNKNOWN: "bg-zinc-400",
};

/** A recognisable icon per well-known environment name; anything custom gets the server icon. */
export function EnvIcon({ name, size }: { name: string; size: number }) {
  const n = name.trim().toLowerCase();
  if (n.startsWith("dev") || n === "local") return <Laptop size={size} />;
  if (n === "qa" || n === "test" || n.startsWith("qa")) return <FlaskConical size={size} />;
  if (n === "uat" || n.includes("stag") || n.includes("pre")) return <ClipboardCheck size={size} />;
  if (n.startsWith("prod") || n === "live") return <Rocket size={size} />;
  if (n.includes("demo") || n.includes("sandbox")) return <Globe size={size} />;
  return <Server size={size} />;
}

function hostOf(url: string): string {
  try {
    const u = new URL(url);
    // Host plus path, so https://host/app shows as host/app; a bare trailing slash is dropped.
    return u.host + (u.pathname === "/" ? "" : u.pathname.replace(/\/$/, ""));
  } catch {
    return url;
  }
}

type MenuItem = { label: string; icon: React.ElementType<{ size?: number }>; onClick: () => void; danger?: boolean; disabled?: boolean };

/** The "more" menu that holds the less common actions, so the card header stays readable. */
function ActionMenu({ items, label }: { items: MenuItem[]; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);
  if (items.length === 0) return null;
  return (
    <div ref={ref} className="relative">
      <button type="button" className={ICON_BUTTON} aria-label={label} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-52 rounded-md border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left disabled:opacity-40 ${
                item.danger
                  ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                  : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
              }`}
            >
              <item.icon size={14} />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Icon-only copy button. After a copy it shows a green "Copied!" in the same spot, then goes back to the icon. */
function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked: leave the icon as it is
    }
  }

  if (copied) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400" role="status">
        <Check size={13} /> Copied!
      </span>
    );
  }
  return (
    <button type="button" onClick={copy} aria-label={label} title={label} className="shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
      <Copy size={13} />
    </button>
  );
}

function Detail({ label, copy, children }: { label: string; copy?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">{label}</dt>
      <dd className="mt-1 flex items-start gap-1.5 text-sm font-medium text-zinc-800 dark:text-zinc-100">
        <span className="min-w-0 break-words">{children}</span>
        {copy && <CopyButton text={copy} label={`Copy ${label.toLowerCase()}`} />}
      </dd>
    </div>
  );
}

function UrlValue({ url }: { url: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" title={url} className="inline-flex max-w-full items-center gap-1 hover:text-orange-600 hover:underline dark:hover:text-orange-400">
      <span className="truncate">{hostOf(url)}</span>
    </a>
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
  knownRoles,
  defaultOpen,
  run,
  onMove,
}: {
  env: EnvironmentView;
  projectId: string;
  canEdit: boolean;
  isFirst: boolean;
  isLast: boolean;
  takenNames: string[];
  knownRoles: KnownRole[];
  defaultOpen: boolean;
  run: (fn: () => Promise<ApiResult>) => Promise<void>;
  onMove: (direction: -1 | 1) => void;
}) {
  const base = `/api/projects/${projectId}/environments/${env.id}`;
  const [editing, setEditing] = useState<Editing>(null);
  const [confirm, setConfirm] = useState<null | { kind: "env" } | { kind: "link"; id: string } | { kind: "cred"; id: string }>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [pinging, setPinging] = useState(false);
  const [open, setOpen] = useState(defaultOpen);

  const mainUrl = env.appUrl ?? env.apiUrl;
  const hasDetails = Boolean(env.appUrl || env.apiUrl || env.healthUrl || env.hosting || env.databaseSet || env.version || env.lastDeployedAt);
  const expanded = open || editing === "env";
  const summary = [
    mainUrl ? hostOf(mainUrl) : null,
    env.version,
    `${env.links.length} link${env.links.length === 1 ? "" : "s"}`,
    env.isProduction ? null : `${env.credentials.length} test user${env.credentials.length === 1 ? "" : "s"}`,
  ]
    .filter(Boolean)
    .join(" · ");

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

  const menuItems: MenuItem[] = [
    ...(env.healthUrl
      ? [{ label: "Open health check", icon: Activity, onClick: () => window.open(env.healthUrl as string, "_blank", "noopener,noreferrer") }]
      : []),
    ...(canEdit
      ? [
          {
            label: "Edit",
            icon: Pencil,
            onClick: () => {
              setOpen(true);
              setEditing("env");
            },
          },
          {
            label: "Duplicate (no test users)",
            icon: Copy,
            onClick: () => {
              const name = window.prompt(`Name for the copy of ${env.name}:`, `${env.name} copy`)?.trim();
              if (name) run(() => call("POST", `/api/projects/${projectId}/environments`, { duplicateFrom: env.id, name })).catch(() => {});
            },
          },
          { label: "Move up", icon: ChevronUp, onClick: () => onMove(-1), disabled: isFirst },
          { label: "Move down", icon: ChevronDown, onClick: () => onMove(1), disabled: isLast },
          { label: "Delete", icon: Trash2, onClick: () => setConfirm({ kind: "env" }), danger: true },
        ]
      : []),
  ];

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
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
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                <EnvIcon name={env.name} size={20} />
              </div>
              <h3 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{env.name}</h3>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[env.status]}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[env.status]}`} />
                {STATUS_LABEL[env.status]}
              </span>
              {env.isProduction && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                  <ShieldAlert size={12} /> Production
                </span>
              )}
              {!expanded && <span className="hidden min-w-0 truncate text-xs text-zinc-400 md:inline">{summary}</span>}
            </div>
            <div className="flex items-center gap-2">
              {mainUrl && (
                <>
                  <Button href={mainUrl} external icon={ExternalLink} variant="secondary" size="sm" className="rounded-lg">
                    Open
                  </Button>
                  <Button variant="secondary" size="sm" icon={copiedUrl ? Check : Copy} onClick={copyUrl} className="rounded-lg">
                    {copiedUrl ? "Copied" : "Copy URL"}
                  </Button>
                </>
              )}
              {canEdit && env.healthUrl && (
                <Button variant="secondary" size="sm" icon={Activity} onClick={ping} loading={pinging} className="rounded-lg" title="Check the health URL and update the status">
                  Ping
                </Button>
              )}
              <button type="button" className={ICON_BUTTON} onClick={() => setOpen((v) => !v)} aria-expanded={expanded} aria-label={expanded ? "Collapse" : "Expand"}>
                <ChevronDown size={16} className={`transition-transform ${expanded ? "" : "-rotate-90"}`} />
              </button>
              <ActionMenu items={menuItems} label={`More actions for ${env.name}`} />
            </div>
          </div>

          {expanded && (
            <div className="mt-5 space-y-4 border-t border-zinc-100 pt-5 dark:border-zinc-800">
              {hasDetails ? (
                <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
                  {env.appUrl && (
                    <Detail label="App" copy={env.appUrl}>
                      <UrlValue url={env.appUrl} />
                    </Detail>
                  )}
                  {env.apiUrl && (
                    <Detail label="API / gateway" copy={env.apiUrl}>
                      <UrlValue url={env.apiUrl} />
                    </Detail>
                  )}
                  {env.healthUrl && (
                    <Detail label="Health check" copy={env.healthUrl}>
                      <UrlValue url={env.healthUrl} />
                    </Detail>
                  )}
                  {env.hosting && <Detail label="Hosting" copy={env.hosting}>{env.hosting}</Detail>}
                  {env.databaseSet && (
                    <Detail label="Database set" copy={env.databaseSet}>
                      <span className="inline-flex items-center gap-1.5">
                        <Database size={13} className="shrink-0 text-zinc-400" />
                        {env.databaseSet}
                      </span>
                    </Detail>
                  )}
                  {env.version && <Detail label="Version / tag" copy={env.version}>{env.version}</Detail>}
                  {env.lastDeployedAt && (
                    <Detail label="Last deployed">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarClock size={13} className="shrink-0 text-zinc-400" />
                        {new Date(env.lastDeployedAt).toLocaleDateString()}
                      </span>
                    </Detail>
                  )}
                </dl>
              ) : (
                <p className="text-sm text-zinc-400">No details yet.{canEdit ? " Use the menu, then Edit, to add URLs, hosting and more." : ""}</p>
              )}
              {env.notes && (
                <div className="flex items-start gap-3 rounded-xl bg-blue-500/5 px-4 py-3 text-sm text-zinc-700 dark:bg-blue-400/10 dark:text-zinc-200">
                  <Info size={16} className="mt-0.5 shrink-0 text-blue-500" />
                  <p className="whitespace-pre-wrap">{env.notes}</p>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
                <span className="inline-flex items-center gap-1.5">
                  <Clock size={13} />
                  <EditedBy name={env.updatedByName} at={env.updatedAt} />
                </span>
                {env.lastCheckedAt && <span suppressHydrationWarning>Health checked {formatRelativeTime(env.lastCheckedAt)}</span>}
              </div>
            </div>
          )}
        </>
      )}

      {expanded && (
        <>
      {/* Links */}
      <div className="mt-5 border-t border-zinc-100 pt-5 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Links</h4>
          {canEdit && editing !== "newLink" && (
            <Button variant="secondary" size="sm" icon={Plus} onClick={() => setEditing("newLink")} className="rounded-lg">
              Add link
            </Button>
          )}
        </div>
        {env.links.length === 0 && editing !== "newLink" && (
          <p className="mt-3 text-sm text-zinc-400">No links yet.{canEdit ? " Add docs, dashboards or portal pages for this environment." : ""}</p>
        )}
        {env.links.length > 0 && (
          <ul className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
            {env.links.map((l) =>
              typeof editing === "object" && editing && "link" in editing && editing.link === l.id ? (
                <li key={l.id} className="lg:col-span-2">
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
                <li key={l.id} className="group flex items-center gap-3 rounded-xl bg-zinc-50 px-3 py-2.5 dark:bg-zinc-800/50">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                    <Link2 size={16} />
                  </div>
                  <a href={l.url} target="_blank" rel="noopener noreferrer" title={l.url} className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-zinc-900 group-hover:text-orange-600 dark:text-zinc-100 dark:group-hover:text-orange-400">{l.label}</span>
                      {l.group && <span className="shrink-0 rounded-full bg-zinc-200/70 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-700 dark:text-zinc-300">{l.group}</span>}
                    </span>
                    <span className="block truncate text-xs text-zinc-400">{hostOf(l.url)}</span>
                  </a>
                  <div className="flex shrink-0 items-center transition sm:opacity-0 sm:focus-within:opacity-100 sm:group-hover:opacity-100">
                    <CopyButton text={l.url} label="Copy link" />
                    <a href={l.url} target="_blank" rel="noopener noreferrer" className={ICON_BUTTON} aria-label="Open link" title="Open in a new tab">
                      <ExternalLink size={14} />
                    </a>
                    {canEdit && (
                      <>
                        <button type="button" className={ICON_BUTTON} onClick={() => setEditing({ link: l.id })} aria-label="Edit link" title="Edit">
                          <Pencil size={14} />
                        </button>
                        <button type="button" className={ICON_BUTTON} onClick={() => setConfirm({ kind: "link", id: l.id })} aria-label="Delete link" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ),
            )}
          </ul>
        )}
        {editing === "newLink" && (
          <div className="mt-3">
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
      <div className="mt-5 border-t border-zinc-100 pt-5 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Test users</h4>
          {canEdit && !env.isProduction && editing !== "newCred" && (
            <Button variant="secondary" size="sm" icon={Plus} onClick={() => setEditing("newCred")} className="rounded-lg">
              Add test user
            </Button>
          )}
        </div>
        {env.isProduction ? (
          <div className="mt-3 flex items-start gap-3 rounded-xl bg-amber-500/5 px-4 py-3 text-sm text-zinc-600 dark:bg-amber-400/10 dark:text-zinc-300">
            <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-500" />
            Production environments never store test users or passwords.
          </div>
        ) : (
          <>
            {env.credentials.length === 0 && editing !== "newCred" && (
              <p className="mt-3 text-sm text-zinc-400">No test users yet.{canEdit ? " Add the accounts testers should use here." : ""}</p>
            )}
            {env.credentials.length > 0 && (
              <ul className="mt-3 space-y-2">
                {env.credentials.map((c) =>
                  typeof editing === "object" && editing && "cred" in editing && editing.cred === c.id ? (
                    <li key={c.id}>
                      <CredentialForm
                        initial={c}
                        knownRoles={knownRoles}
                        onCancel={() => setEditing(null)}
                        onSave={async (body) => {
                          await run(() => call("PUT", `${base}/credentials/${c.id}`, body));
                          setEditing(null);
                        }}
                      />
                    </li>
                  ) : (
                    <CredentialItem key={c.id} cred={c} canEdit={canEdit} base={base} openUrl={mainUrl} onEdit={() => setEditing({ cred: c.id })} onDelete={() => setConfirm({ kind: "cred", id: c.id })} />
                  ),
                )}
              </ul>
            )}
            {editing === "newCred" && (
              <div className="mt-3">
                <CredentialForm
                  knownRoles={knownRoles}
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

        </>
      )}

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

/** One-time setup for "Login & open": a draggable bookmark that fills a login page from what was copied. */
function FillLoginHelp() {
  const link = useRef<HTMLAnchorElement>(null);
  const [copied, setCopied] = useState(false);

  // React refuses to render javascript: links, so the bookmark's address is set on the element directly.
  useEffect(() => {
    link.current?.setAttribute("href", FILL_BOOKMARKLET);
  }, []);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(FILL_BOOKMARKLET);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked: the drag still works
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p className="font-medium text-zinc-900 dark:text-zinc-100">Fill login pages with one click</p>
      <ol className="list-decimal space-y-1.5 pl-5 text-zinc-600 dark:text-zinc-300">
        <li>
          Once: drag this button onto your bookmarks bar{" "}
          <a
            ref={link}
            draggable
            onClick={(e) => e.preventDefault()}
            title="Drag me to the bookmarks bar"
            className="mx-1 inline-flex cursor-grab items-center gap-1.5 rounded-md border border-dashed border-orange-400 px-2 py-0.5 text-xs font-medium text-orange-600 dark:text-orange-400"
          >
            <Bookmark size={12} /> Fill login
          </a>{" "}
          (or{" "}
          <button type="button" onClick={copyCode} className="text-orange-600 underline dark:text-orange-400">
            {copied ? "copied!" : "copy its code"}
          </button>{" "}
          and paste it as the address of a new bookmark).
        </li>
        <li>On a test user, click <strong>Login &amp; open</strong>. This copies the login and opens the app.</li>
        <li>On the login page, click the <strong>Fill login</strong> bookmark. The username and password fill in and the copy is cleared.</li>
      </ol>
      <p className="text-xs text-zinc-400">
        The bookmark holds no username or password. The first time, your browser may ask to let the page read the clipboard. On plain http pages it
        asks you to paste instead.
      </p>
    </div>
  );
}

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
  const [showFill, setShowFill] = useState(false);
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
  const knownRoles = envs.flatMap((e) => e.credentials.map((c) => ({ purpose: c.purpose, icon: c.icon })));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {envs.length === 0
            ? "Where this project runs, how to reach it, and the test accounts to use."
            : `${envs.length} environment${envs.length === 1 ? "" : "s"} · ${envs.filter((e) => e.status === "LIVE").length} live · production never stores test users`}
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
          {canEdit && (
            <Button variant="secondary" size="sm" icon={Bookmark} onClick={() => setShowFill((v) => !v)} title="Set up one-click filling of login pages">
              Login fill
            </Button>
          )}
          {canEdit && !adding && (
            <Button variant="primary" size="sm" icon={Plus} onClick={() => setAdding(true)}>
              Add environment
            </Button>
          )}
        </div>
      </div>

      {showFill && canEdit && <FillLoginHelp />}

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
            knownRoles={knownRoles}
            defaultOpen={false}
            run={run}
            onMove={(d) => move(i, d)}
          />
        ))
      )}
    </div>
  );
}
