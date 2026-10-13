"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { Switch } from "@/components/ui/Switch";
import { DEFAULT_AI_SETTINGS, type AiSettings } from "@/lib/aiSettings";
import { RESOURCE_LABELS } from "@/lib/auth/permissionLabels";
import { AI_FEATURES } from "@/lib/auth/permissions";
import { cn } from "@/lib/cn";

type QuotaRow = {
  userId: string;
  name: string;
  email: string;
  dailyRequests: number | null;
  monthlyTokens: number | null;
};
type UserOption = { id: string; name: string; email: string };

const inputClass =
  "h-10 w-28 rounded-md border border-zinc-200 bg-white px-3 text-right text-sm tabular-nums text-zinc-900 outline-none transition-colors focus:border-orange-500 focus:ring-4 focus:ring-orange-500/15 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";

const limitText = (v: number | null, unit: string) =>
  v === null
    ? "Default"
    : v === 0
      ? "Unlimited"
      : `${v.toLocaleString("en-US")} ${unit}`;

/** Empty box = null (use the default). Anything else must be a whole number. */
function parseLimit(text: string): number | null | "invalid" {
  const t = text.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= 0 ? n : "invalid";
}

export function AiControls() {
  const [saved, setSaved] = useState<AiSettings | null>(null);
  const [draft, setDraft] = useState<AiSettings>({
    ...DEFAULT_AI_SETTINGS,
    features: {},
  });
  const [quotas, setQuotas] = useState<QuotaRow[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);

  // exception form
  const [pickUser, setPickUser] = useState("");
  const [pickDaily, setPickDaily] = useState("");
  const [pickMonthly, setPickMonthly] = useState("");
  const [exceptionError, setExceptionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/admin/ai/settings").then((r) => r.json()),
      fetch("/api/admin/ai/quotas").then((r) => r.json()),
      fetch("/api/admin/users").then((r) => (r.ok ? r.json() : { users: [] })),
    ])
      .then(
        ([s, q, u]: [
          { settings?: AiSettings },
          { quotas?: QuotaRow[] },
          { users?: UserOption[] },
        ]) => {
          if (cancelled) return;
          if (s.settings) {
            setSaved(s.settings);
            setDraft(s.settings);
          }
          setQuotas(q.quotas ?? []);
          setUsers(
            (u.users ?? []).map((x) => ({
              id: x.id,
              name: x.name,
              email: x.email,
            })),
          );
        },
      )
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty =
    saved !== null && JSON.stringify(draft) !== JSON.stringify(saved);

  function setFeature(feature: string, on: boolean) {
    setDraft((d) => ({ ...d, features: { ...d.features, [feature]: on } }));
    setMessage(null);
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/ai/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: draft }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        settings?: AiSettings;
      };
      if (!res.ok || !body.settings) {
        setMessage({ kind: "error", text: body.error ?? "Failed to save" });
        return;
      }
      setSaved(body.settings);
      setDraft(body.settings);
      setMessage({
        kind: "ok",
        text: "Saved. It applies within a few seconds.",
      });
    } catch {
      setMessage({ kind: "error", text: "Network error — please try again" });
    } finally {
      setSaving(false);
    }
  }

  async function addException() {
    setExceptionError(null);
    const daily = parseLimit(pickDaily);
    const monthly = parseLimit(pickMonthly);
    if (!pickUser) return setExceptionError("Choose a person.");
    if (daily === "invalid" || monthly === "invalid")
      return setExceptionError(
        "Use whole numbers, or leave a box empty to use the default.",
      );
    if (daily === null && monthly === null)
      return setExceptionError("Set at least one limit.");
    const res = await fetch("/api/admin/ai/quotas", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: pickUser,
        dailyRequests: daily,
        monthlyTokens: monthly,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      quota?: QuotaRow;
    };
    if (!res.ok || !body.quota)
      return setExceptionError(body.error ?? "Could not save.");
    const quota = body.quota;
    setQuotas((prev) =>
      [...prev.filter((q) => q.userId !== quota.userId), quota].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    );
    setPickUser("");
    setPickDaily("");
    setPickMonthly("");
  }

  async function removeException(userId: string) {
    const res = await fetch(
      `/api/admin/ai/quotas?userId=${encodeURIComponent(userId)}`,
      { method: "DELETE" },
    );
    if (res.ok) setQuotas((prev) => prev.filter((q) => q.userId !== userId));
  }

  const loading = saved === null;
  // Everyone already holding an exception is left out, so adding one never silently overwrites another.
  const userOptions = users
    .filter((u) => !quotas.some((q) => q.userId === u.id))
    .map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }));

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="space-y-6">
        <SettingsCard
          title="AI access"
          description="Turn AI off everywhere, or feature by feature. Who may use a feature is still set per role on the Permissions page."
        >
          <div className="space-y-5">
            <div
              className={cn(
                "flex items-center justify-between gap-4 rounded-lg border p-4",
                draft.enabled
                  ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-500/20 dark:bg-emerald-500/5"
                  : "border-red-200 bg-red-50/60 dark:border-red-500/30 dark:bg-red-500/10",
              )}
            >
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  AI features{" "}
                  {draft.enabled ? "are on" : "are off for everyone"}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  The master switch. Turning it off blocks every assistant
                  immediately.
                </p>
              </div>
              <Switch
                size="md"
                checked={draft.enabled}
                disabled={loading}
                onChange={(v) => setDraft((d) => ({ ...d, enabled: v }))}
                label="AI features master switch"
              />
            </div>

            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {AI_FEATURES.map((feature) => (
                <li
                  key={feature}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <span
                    className={cn(
                      "text-sm font-medium",
                      draft.enabled
                        ? "text-zinc-900 dark:text-zinc-100"
                        : "text-zinc-400",
                    )}
                  >
                    {RESOURCE_LABELS[feature]}
                  </span>
                  <Switch
                    checked={draft.features[feature] !== false}
                    disabled={loading || !draft.enabled}
                    onChange={(v) => setFeature(feature, v)}
                    label={`${RESOURCE_LABELS[feature]} on or off`}
                  />
                </li>
              ))}
            </ul>
          </div>
        </SettingsCard>

        <SettingsCard
          title="Default limits"
          description="Applied to everyone who doesn't have an exception. 0 means unlimited."
        >
          <div className="space-y-1 divide-y divide-zinc-100 dark:divide-zinc-800">
            {(
              [
                [
                  "defaultDailyRequests",
                  "Requests per person per day",
                  "Resets at midnight UTC.",
                  "requests",
                ],
                [
                  "defaultMonthlyTokens",
                  "Tokens per person per month",
                  "Input plus output tokens. Resets on the 1st (UTC).",
                  "tokens",
                ],
              ] as const
            ).map(([key, label, hint, unit]) => (
              <div
                key={key}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0 flex-1 basis-64">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {label}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {hint}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={Number.isNaN(draft[key]) ? "" : draft[key]}
                    onChange={(e) => {
                      setDraft((d) => ({
                        ...d,
                        [key]:
                          e.target.value === ""
                            ? Number.NaN
                            : Number(e.target.value),
                      }));
                      setMessage(null);
                    }}
                    aria-label={label}
                    className={inputClass}
                  />
                  <span className="w-16 text-xs text-zinc-500 dark:text-zinc-400">
                    {unit}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {message && (
            <p
              role={message.kind === "error" ? "alert" : "status"}
              className={cn(
                "mt-3 text-sm",
                message.kind === "error"
                  ? "text-red-600 dark:text-red-400"
                  : "text-emerald-600 dark:text-emerald-400",
              )}
            >
              {message.text}
            </p>
          )}
          <div className="mt-4">
            <Button
              variant="primary"
              loading={saving}
              disabled={
                !dirty ||
                Number.isNaN(draft.defaultDailyRequests) ||
                Number.isNaN(draft.defaultMonthlyTokens)
              }
              onClick={() => void save()}
            >
              Save changes
            </Button>
          </div>
        </SettingsCard>
      </div>

      <SettingsCard
        title="Exceptions"
        description="Give a person their own limits. Leave a box empty to keep the default for it; 0 is unlimited."
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Dropdown
              value={pickUser}
              onChange={setPickUser}
              options={userOptions}
              placeholder="Choose a person…"
              aria-label="Person"
            />
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                min={0}
                placeholder="Requests/day"
                value={pickDaily}
                onChange={(e) => setPickDaily(e.target.value)}
                aria-label="Requests per day"
                className={cn(inputClass, "w-36 text-left")}
              />
              <input
                type="number"
                min={0}
                placeholder="Tokens/month"
                value={pickMonthly}
                onChange={(e) => setPickMonthly(e.target.value)}
                aria-label="Tokens per month"
                className={cn(inputClass, "w-36 text-left")}
              />
              <Button
                variant="secondary"
                icon={Plus}
                onClick={() => void addException()}
              >
                Add
              </Button>
            </div>
            {exceptionError && (
              <p
                role="alert"
                className="text-xs text-red-600 dark:text-red-400"
              >
                {exceptionError}
              </p>
            )}
          </div>

          {quotas.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-200 px-3 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              No exceptions. Everyone uses the defaults.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {quotas.map((q) => (
                <li key={q.userId} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {q.name}
                    </p>
                    <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                      {limitText(q.dailyRequests, "requests/day")} ·{" "}
                      {limitText(q.monthlyTokens, "tokens/month")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void removeException(q.userId)}
                    aria-label={`Remove exception for ${q.name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SettingsCard>
    </div>
  );
}
