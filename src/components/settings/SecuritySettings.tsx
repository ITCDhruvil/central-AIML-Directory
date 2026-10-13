"use client";

import { useEffect, useState } from "react";
import { Check, History, Loader2, LogOut, ShieldCheck, X } from "lucide-react";
import { PasswordField } from "@/components/auth/NewPasswordForm";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import { useSecurityPolicy } from "@/components/PolicyProvider";
import {
  ForgotCurrentPassword,
  type OwnResetStatus,
} from "@/components/settings/ForgotCurrentPassword";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { passwordStrength } from "@/lib/auth/passwordStrength";
import { cn } from "@/lib/cn";

/** Change your own password. The server checks the current one, the strength minimum and the no-reuse rule. */
export function SecuritySettings() {
  // "forgot" swaps the change-password form for the reset-request panel (same card, so nothing reloads).
  const [mode, setMode] = useState<"change" | "forgot">("change");
  const [resetStatus, setResetStatus] = useState<OwnResetStatus>({
    state: "none",
  });
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);

  const policy = useSecurityPolicy();
  const strength = passwordStrength(next, policy);
  const matches = next.length > 0 && next === confirm;
  const differs = next.length > 0 && next !== current;
  const ready =
    current.length > 0 && strength.meetsRequirements && matches && differs;

  // An earlier request may still be open (or have just come due): pick it up so the person sees where it stands.
  // This is the only place that reads the status on load, because reading it can be the call that issues the password.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/account/reset-request")
      .then((res) => (res.ok ? res.json() : null))
      .then((body: OwnResetStatus | null) => {
        if (cancelled || !body || body.state === "none") return;
        setResetStatus(body);
        setMode("forgot");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setPending(true);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setMessage({
          kind: "error",
          text: body.error ?? "Could not change the password.",
        });
        return;
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      setMessage({
        kind: "ok",
        text: "Password changed. Your other devices have been signed out.",
      });
    } catch {
      setMessage({ kind: "error", text: "Network error. Try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <SettingsCard
        title={mode === "forgot" ? "Reset your password" : "Password"}
        description={
          mode === "forgot"
            ? "Ask an administrator for a temporary password."
            : "Use a strong password you don't use anywhere else."
        }
      >
        {mode === "forgot" ? (
          <div className="view-fade">
            <ForgotCurrentPassword
              initial={resetStatus}
              onBack={() => setMode("change")}
            />
          </div>
        ) : (
          <form
            onSubmit={submit}
            className="view-fade max-w-xl space-y-5"
            noValidate
          >
            <div className="space-y-2">
              <PasswordField
                id="current-password"
                label="Current password"
                value={current}
                onChange={setCurrent}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setMode("forgot")}
                className="text-sm font-medium text-orange-600 hover:text-orange-700"
              >
                Forgot current password?
              </button>
            </div>
            <PasswordField
              id="new-password"
              label="New password"
              value={next}
              onChange={setNext}
              tone={confirm.length === 0 ? "neutral" : matches ? "good" : "bad"}
            />
            <div className="space-y-2">
              <PasswordField
                id="confirm-password"
                label="Confirm new password"
                value={confirm}
                onChange={setConfirm}
                tone={
                  confirm.length === 0 ? "neutral" : matches ? "good" : "bad"
                }
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
              password={next}
              extraRules={[
                { label: "Different from your current password", ok: differs },
              ]}
            />
            <p className="text-[11px] text-zinc-400">
              * required. The rest make it stronger. You can&apos;t reuse a
              recent password.
            </p>

            {message && (
              <p
                role={message.kind === "error" ? "alert" : "status"}
                className={cn(
                  "flex items-start gap-2 rounded-md px-3 py-2 text-sm",
                  message.kind === "error"
                    ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                    : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
                )}
              >
                {message.kind === "ok" && (
                  <ShieldCheck size={16} className="mt-0.5 shrink-0" />
                )}
                {message.text}
              </p>
            )}

            <button
              type="submit"
              disabled={!ready || pending}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-orange-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending && <Loader2 size={15} className="animate-spin" />}
              Change password
            </button>
          </form>
        )}
      </SettingsCard>

      <SettingsCard
        title="Good to know"
        description="What happens when you change your password."
      >
        <ul className="space-y-4 text-sm">
          {[
            {
              icon: LogOut,
              title: "Other devices are signed out",
              text: "Changing your password ends every other session, so a lost laptop or old browser can't stay signed in.",
            },
            {
              icon: History,
              title: "No going back",
              text: "You can't reuse your current password or any of your last five.",
            },
            {
              icon: ShieldCheck,
              title: "Forgot it?",
              text: 'Use "Forgot password?" on the sign-in page. An administrator will send you a temporary password.',
            },
          ].map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-500/15">
                <Icon size={16} />
              </span>
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {title}
                </p>
                <p className="mt-0.5 text-zinc-500 dark:text-zinc-400">
                  {text}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </SettingsCard>
    </div>
  );
}
