"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Mail,
} from "lucide-react";
import { usernameToEmail } from "@/lib/emailDomain";

function BackLink({
  onBack,
  className,
}: {
  onBack?: () => void;
  className: string;
}) {
  const content = (
    <>
      <ArrowLeft size={16} />
      Back to sign in
    </>
  );
  if (onBack) {
    return (
      <button type="button" onClick={onBack} className={className}>
        {content}
      </button>
    );
  }
  return (
    <Link href="/login" className={className}>
      {content}
    </Link>
  );
}

const fieldClass =
  "flex h-12 w-full items-center overflow-hidden rounded-md border border-zinc-200 bg-white text-sm text-zinc-900 transition-colors focus-within:border-orange-500 focus-within:ring-4 focus-within:ring-orange-500/15 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";

export function ForgotPasswordForm({
  domain,
  initialUsername = "",
  onBack,
}: {
  domain: string;
  initialUsername?: string;
  /** When set (modal use), "Back to sign in" calls this instead of navigating to /login. */
  onBack?: () => void;
}) {
  const [username, setUsername] = useState(initialUsername);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const built = usernameToEmail(username, domain);
    if (!built.ok) {
      setError(built.error);
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      setSent(data.message ?? "An administrator has been notified.");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-6">
        <div className="flex items-start gap-3 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <p>{sent}</p>
        </div>
        <BackLink
          onBack={onBack}
          className="flex items-center gap-2 text-sm font-medium text-orange-600 hover:text-orange-700"
        />
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="space-y-2">
        <label
          htmlFor="username"
          className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
        >
          Username
        </label>
        <div className={fieldClass}>
          <Mail
            size={18}
            strokeWidth={1.75}
            className="ml-4 shrink-0 text-zinc-400"
            aria-hidden
          />
          <input
            id="username"
            type="text"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            placeholder="first.last"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="autofill-clean h-full min-w-0 flex-1 bg-transparent px-3 outline-none placeholder:text-zinc-400"
          />
          <span className="flex h-full shrink-0 select-none items-center border-l border-zinc-200 bg-zinc-50 px-4 text-sm font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            @{domain}
          </span>
        </div>
      </div>

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
        disabled={pending}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-orange-600 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(234,88,12,0.55)] transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Sending…
          </>
        ) : (
          <>
            Request reset
            <ArrowRight size={16} strokeWidth={2} />
          </>
        )}
      </button>

      <BackLink
        onBack={onBack}
        className="flex items-center justify-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
      />
    </form>
  );
}
