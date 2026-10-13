"use client";

import { useState } from "react";
import { Check, Eye, EyeOff, Loader2, Lock, X } from "lucide-react";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import { useSecurityPolicy } from "@/components/PolicyProvider";
import { passwordStrength } from "@/lib/auth/passwordStrength";
import { cn } from "@/lib/cn";

const fieldBase =
  "flex h-12 w-full items-center overflow-hidden rounded-md border bg-white text-sm text-zinc-900 transition-colors focus-within:ring-4 dark:bg-zinc-950 dark:text-zinc-50";
const fieldNeutral =
  "border-zinc-200 focus-within:border-orange-500 focus-within:ring-orange-500/15 dark:border-zinc-700";
const fieldGood =
  "border-emerald-500 focus-within:border-emerald-500 focus-within:ring-emerald-500/15";
const fieldBad =
  "border-red-400 focus-within:border-red-500 focus-within:ring-red-500/15";

export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoFocus,
  autoComplete = "new-password",
  tone = "neutral",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  autoComplete?: string;
  tone?: "neutral" | "good" | "bad";
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
      >
        {label}
      </label>
      <div
        className={cn(
          fieldBase,
          tone === "good"
            ? fieldGood
            : tone === "bad"
              ? fieldBad
              : fieldNeutral,
        )}
      >
        <Lock
          size={18}
          strokeWidth={1.75}
          className={cn(
            "ml-4 shrink-0 transition-colors",
            tone === "good"
              ? "text-emerald-500"
              : tone === "bad"
                ? "text-red-500"
                : "text-zinc-400",
          )}
          aria-hidden
        />
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="autofill-clean h-full min-w-0 flex-1 bg-transparent px-3 outline-none placeholder:text-zinc-400"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={
            visible
              ? `Hide ${label.toLowerCase()}`
              : `Show ${label.toLowerCase()}`
          }
          className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
        >
          {visible ? (
            <EyeOff size={18} strokeWidth={1.75} />
          ) : (
            <Eye size={18} strokeWidth={1.75} />
          )}
        </button>
      </div>
    </div>
  );
}

/**
 * Replaces the login form after signing in with a temporary password. The temporary password is the one just typed, so
 * it isn't asked again. Every rule shown must pass before saving; the server enforces its own minimum and also refuses a
 * recently used password (that message is shown here).
 */
export function NewPasswordForm({
  currentPassword,
  onDone,
}: {
  currentPassword: string;
  onDone: () => void;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const strength = passwordStrength(newPassword, useSecurityPolicy());
  const matches = newPassword.length > 0 && newPassword === confirm;
  const differs = newPassword.length > 0 && newPassword !== currentPassword;
  const ready = strength.meetsRequirements && matches && differs;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not change the password.");
        return;
      }
      onDone();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  const confirmTone =
    confirm.length === 0 ? "neutral" : matches ? "good" : "bad";

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <PasswordField
        id="new-password"
        label="New password"
        value={newPassword}
        onChange={setNewPassword}
        autoFocus
        tone={confirmTone}
      />

      <div className="space-y-2">
        <PasswordField
          id="confirm-password"
          label="Confirm password"
          value={confirm}
          onChange={setConfirm}
          tone={confirmTone}
        />
        {confirm.length > 0 && (
          <p
            role="status"
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium",
              matches
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-500",
            )}
          >
            {matches ? (
              <Check size={14} strokeWidth={2.5} />
            ) : (
              <X size={14} strokeWidth={2.5} />
            )}
            {matches ? "Passwords match" : "Passwords don't match"}
          </p>
        )}
      </div>

      <PasswordStrengthMeter
        password={newPassword}
        extraRules={[
          { label: "Different from your temporary password", ok: differs },
        ]}
      />
      <p className="text-[11px] text-zinc-400">
        * required. The rest make it stronger. You can&apos;t reuse a recent
        password.
      </p>

      {error && (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !ready}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-orange-600 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(234,88,12,0.55)] transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
      >
        {pending ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Saving…
          </>
        ) : (
          "Save and continue"
        )}
      </button>
    </form>
  );
}
