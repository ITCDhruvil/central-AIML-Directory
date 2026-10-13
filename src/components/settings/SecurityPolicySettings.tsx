"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { useSecurityPolicy } from "@/components/PolicyProvider";
import {
  DEFAULT_SECURITY_POLICY,
  POLICY_RANGES,
  type SecurityPolicy,
} from "@/lib/securityPolicy";
import { cn } from "@/lib/cn";

type NumberKey =
  | "passwordMinLength"
  | "passwordHistoryCount"
  | "resetAutoIssueMinutes"
  | "sessionHours"
  | "rememberDays"
  | "loginMaxFailures"
  | "loginWindowMinutes";

const RANGE = Object.fromEntries(
  POLICY_RANGES.map((r) => [r.key, r]),
) as Record<NumberKey, (typeof POLICY_RANGES)[number]>;

function NumberRow({
  label,
  hint,
  unit,
  value,
  onChange,
  field,
}: {
  label: string;
  hint: string;
  unit: string;
  value: number;
  onChange: (next: number) => void;
  field: NumberKey;
}) {
  const { min, max } = RANGE[field];
  const invalid = !Number.isInteger(value) || value < min || value > max;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0 flex-1 basis-64">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {label}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={Number.isNaN(value) ? "" : value}
          onChange={(e) =>
            onChange(
              e.target.value === "" ? Number.NaN : Number(e.target.value),
            )
          }
          aria-label={label}
          aria-invalid={invalid}
          className={cn(
            "h-10 w-24 rounded-md border bg-white px-3 text-right text-sm tabular-nums text-zinc-900 outline-none transition-colors focus:ring-4 dark:bg-zinc-950 dark:text-zinc-50",
            invalid
              ? "border-red-400 focus:border-red-500 focus:ring-red-500/15"
              : "border-zinc-200 focus:border-orange-500 focus:ring-orange-500/15 dark:border-zinc-700",
          )}
        />
        <span className="w-14 text-xs text-zinc-500 dark:text-zinc-400">
          {unit}
        </span>
      </div>
    </div>
  );
}

function SwitchRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {label}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>
      </div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {title}
      </h3>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {children}
      </div>
    </div>
  );
}

/**
 * Admin-only. Everything here is read from the saved policy on the next sign-in or password change; people who are
 * already signed in keep their current session length.
 */
export function SecurityPolicySettings() {
  const router = useRouter();
  const saved = useSecurityPolicy();
  const [draft, setDraft] = useState<SecurityPolicy>(saved);
  const [base, setBase] = useState<SecurityPolicy>(saved);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);

  const dirty = (Object.keys(draft) as (keyof SecurityPolicy)[]).some(
    (k) => draft[k] !== base[k],
  );
  const valid = POLICY_RANGES.every((r) => {
    const v = draft[r.key] as number;
    return Number.isInteger(v) && v >= r.min && v <= r.max;
  });
  const atDefaults = (Object.keys(draft) as (keyof SecurityPolicy)[]).every(
    (k) => draft[k] === DEFAULT_SECURITY_POLICY[k],
  );

  function set<K extends keyof SecurityPolicy>(
    key: K,
    value: SecurityPolicy[K],
  ) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setMessage(null);
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/security-policy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policy: draft }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        policy?: SecurityPolicy;
      };
      if (!res.ok || !body.policy) {
        setMessage({ kind: "error", text: body.error ?? "Failed to save" });
        return;
      }
      setDraft(body.policy);
      setBase(body.policy);
      setMessage({
        kind: "ok",
        text: "Saved. It applies from the next sign-in or password change.",
      });
      router.refresh(); // password forms read the policy from the page
    } catch {
      setMessage({ kind: "error", text: "Network error — please try again" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsCard
      title="Security policy"
      description="Password rules, recovery and sign-in protection for everyone."
    >
      <div className="space-y-6">
        <Group title="Passwords">
          <NumberRow
            field="passwordMinLength"
            label="Minimum length"
            hint="Every password must be at least this long."
            unit="characters"
            value={draft.passwordMinLength}
            onChange={(v) => set("passwordMinLength", v)}
          />
          <SwitchRow
            label="Require upper and lower case"
            hint="Both cases must appear in a new password."
            checked={draft.requireMixedCase}
            onChange={(v) => set("requireMixedCase", v)}
          />
          <SwitchRow
            label="Require a symbol"
            hint="At least one character like ! @ # $."
            checked={draft.requireSymbol}
            onChange={(v) => set("requireSymbol", v)}
          />
          <NumberRow
            field="passwordHistoryCount"
            label="Block previous passwords"
            hint="How many old passwords can't be reused. 0 blocks only the current one."
            unit="passwords"
            value={draft.passwordHistoryCount}
            onChange={(v) => set("passwordHistoryCount", v)}
          />
        </Group>

        <Group title="Recovery">
          <NumberRow
            field="resetAutoIssueMinutes"
            label="Auto-issue wait"
            hint="If a signed-in person asks for a reset and no admin answers in this time, a temporary password is issued to them. 0 turns this off."
            unit="minutes"
            value={draft.resetAutoIssueMinutes}
            onChange={(v) => set("resetAutoIssueMinutes", v)}
          />
        </Group>

        <Group title="Sessions">
          <NumberRow
            field="sessionHours"
            label="Session length"
            hint="How long a sign-in lasts without “Remember me”."
            unit="hours"
            value={draft.sessionHours}
            onChange={(v) => set("sessionHours", v)}
          />
          <NumberRow
            field="rememberDays"
            label="Remember-me length"
            hint="How long a sign-in lasts with “Remember me”."
            unit="days"
            value={draft.rememberDays}
            onChange={(v) => set("rememberDays", v)}
          />
        </Group>

        <Group title="Sign-in protection">
          <NumberRow
            field="loginMaxFailures"
            label="Failed sign-ins before lock"
            hint="Per account. Only wrong passwords count."
            unit="attempts"
            value={draft.loginMaxFailures}
            onChange={(v) => set("loginMaxFailures", v)}
          />
          <NumberRow
            field="loginWindowMinutes"
            label="Lock duration"
            hint="How long the account stays locked once the limit is hit."
            unit="minutes"
            value={draft.loginWindowMinutes}
            onChange={(v) => set("loginWindowMinutes", v)}
          />
        </Group>

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

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            loading={saving}
            disabled={!dirty || !valid}
            onClick={() => void save()}
          >
            Save changes
          </Button>
          <Button
            variant="ghost"
            disabled={atDefaults || saving}
            onClick={() => {
              setDraft({ ...DEFAULT_SECURITY_POLICY });
              setMessage(null);
            }}
          >
            Reset to defaults
          </Button>
        </div>
      </div>
    </SettingsCard>
  );
}
