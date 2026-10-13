"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  Loader2,
  Send,
} from "lucide-react";
import { NewPasswordForm } from "@/components/auth/NewPasswordForm";
import { useSecurityPolicy } from "@/components/PolicyProvider";

export type OwnResetStatus =
  | { state: "none" }
  | { state: "pending"; createdAt: string; autoIssueAt: string | null }
  | { state: "issued"; temporaryPassword: string };

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * "I forgot my current password", from inside Settings. Sends the same request administrators see in their list. If no
 * one answers within ten minutes, a temporary password is issued here and shown once, with the form to replace it.
 */
export function ForgotCurrentPassword({
  initial,
  onBack,
}: {
  initial: OwnResetStatus;
  onBack: () => void;
}) {
  const router = useRouter();
  const minutes = useSecurityPolicy().resetAutoIssueMinutes;
  const [status, setStatus] = useState<OwnResetStatus>(initial);
  const [handledByAdmin, setHandledByAdmin] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);

  const waiting = status.state === "pending";

  // Tick the countdown, and ask the server how the request stands. The server issues the password once the time is up.
  useEffect(() => {
    if (!waiting) return;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    const poll = window.setInterval(async () => {
      try {
        const res = await fetch("/api/account/reset-request");
        if (!res.ok) return;
        const body = (await res.json()) as OwnResetStatus;
        if (body.state === "none") setHandledByAdmin(true);
        setStatus(body);
      } catch {
        // offline for a moment: the next poll will catch up
      }
    }, 5000);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(poll);
    };
  }, [waiting]);

  async function send() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/account/reset-request", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as OwnResetStatus & {
        error?: string;
      };
      if (!res.ok) {
        setError(body.error ?? "Could not send the request.");
        return;
      }
      setNow(Date.now());
      setStatus(body);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSending(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked: the password is still visible to select
    }
  }

  const backButton = (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
    >
      <ArrowLeft size={15} />
      Back
    </button>
  );

  if (status.state === "issued") {
    const temp = status.temporaryPassword;
    return (
      <div className="max-w-xl space-y-5">
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-500/30 dark:bg-orange-500/10">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            No administrator answered in time, so here is a temporary password.
          </p>
          <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
            Shown once. Choose your own password below to finish.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="select-all rounded-md bg-white px-3 py-1.5 font-mono text-sm text-zinc-900 ring-1 ring-orange-200 dark:bg-zinc-900 dark:text-zinc-50 dark:ring-orange-500/30">
              {temp}
            </code>
            <button
              type="button"
              onClick={() => copy(temp)}
              className="flex h-8 items-center gap-1.5 rounded-md border border-orange-300 px-2.5 text-xs font-medium text-orange-700 hover:bg-orange-100 dark:border-orange-500/40 dark:text-orange-300 dark:hover:bg-orange-500/20"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
        <NewPasswordForm
          currentPassword={temp}
          onDone={() => {
            // The account no longer needs a password change, so reload what the server renders.
            router.replace("/settings");
            router.refresh();
            onBack();
          }}
        />
      </div>
    );
  }

  if (waiting) {
    // No auto-issue time means the policy has it switched off: the request simply waits for an administrator.
    const remaining = status.autoIssueAt
      ? new Date(status.autoIssueAt).getTime() - now
      : null;
    return (
      <div className="max-w-xl space-y-5">
        <div className="flex items-start gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600 dark:bg-orange-500/15">
            <Clock size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Request sent to the administrators
            </p>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              {remaining === null
                ? "An administrator will set a temporary password for you and give it to you."
                : remaining > 0
                  ? "They'll set a temporary password for you. If nobody answers, one is issued here automatically in"
                  : "Issuing a temporary password…"}
            </p>
            {remaining !== null && remaining > 0 && (
              <p
                className="mt-2 font-mono text-2xl font-semibold tabular-nums text-orange-600"
                suppressHydrationWarning
              >
                {formatRemaining(remaining)}
              </p>
            )}
          </div>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {remaining === null
            ? "You can close this tab; an administrator will contact you."
            : "Keep this tab open: the password appears here when it’s ready."}
        </p>
        {backButton}
      </div>
    );
  }

  if (handledByAdmin) {
    return (
      <div className="max-w-xl space-y-5">
        <div className="flex items-start gap-3 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <p>
            An administrator has handled your request. They&apos;ll give you a
            temporary password; sign in with it and choose a new one.
          </p>
        </div>
        {backButton}
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-5">
      <div>
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Forgot your current password?
        </h3>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          We&apos;ll notify the administrators, who can set a temporary password
          for you.
          {minutes > 0 &&
            ` If nobody replies within ${minutes} ${minutes === 1 ? "minute" : "minutes"}, a temporary password is issued right here, and you’ll be asked to choose a new one.`}
        </p>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400"
        >
          {error}
        </p>
      )}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={send}
          disabled={sending}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-orange-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-orange-700 disabled:opacity-60"
        >
          {sending ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Send size={15} />
          )}
          Send request
        </button>
        {backButton}
      </div>
    </div>
  );
}
