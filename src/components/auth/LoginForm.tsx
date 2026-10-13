"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { usernameToEmail } from "@/lib/emailDomain";
import { CHAT_HISTORY_KEY } from "@/lib/chatHistory";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { NewPasswordForm } from "@/components/auth/NewPasswordForm";

// Shared look for the two fields. The username field is a wrapper (it holds the fixed domain), so the focus ring
// is applied to the wrapper with focus-within.
const fieldClass =
  "flex h-12 w-full items-center overflow-hidden rounded-md border border-zinc-200 bg-white text-sm text-zinc-900 transition-colors focus-within:border-orange-500 focus-within:ring-4 focus-within:ring-orange-500/15 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";
const bareInput =
  "autofill-clean h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-zinc-400";

export function LoginForm({ next, domain }: { next: string; domain: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [view, setView] = useState<"login" | "forgot">("login");
  // Set after signing in with a temporary password: the new-password modal opens over the login page.
  const [mustChange, setMustChange] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    // People type just their username; the company domain is fixed. A full address is fine only on that domain.
    const built = usernameToEmail(username, domain);
    if (!built.ok) {
      setError(built.error);
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: built.email, password, remember }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        mustChangePassword?: boolean;
      };
      if (!res.ok) {
        setError(data.error ?? "Login failed");
        return;
      }
      // A different person may have used this browser before: start with an empty chat history.
      try {
        window.localStorage.removeItem(CHAT_HISTORY_KEY);
      } catch {
        // storage unavailable — nothing to clear
      }
      if (data.mustChangePassword) {
        setMustChange(true);
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  if (mustChange) {
    // Signed in with a temporary password: the new-password step replaces the login form in the same card.
    return (
      <div key="set-password" className="view-fade">
        <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Set a new password
        </h2>
        <p className="mb-6 mt-1.5 text-[15px] text-zinc-500 dark:text-zinc-400">
          You signed in with a temporary password. Choose your own to continue.
        </p>
        <NewPasswordForm
          currentPassword={password}
          onDone={() => {
            router.replace(next);
            router.refresh();
          }}
        />
      </div>
    );
  }

  if (view === "forgot") {
    // Same card, swapped content: no navigation, so no page reload. Keyed so the fade replays each time.
    return (
      <div key="forgot" className="view-fade">
        <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Forgot password?
        </h2>
        <p className="mb-8 mt-1.5 text-[15px] text-zinc-500 dark:text-zinc-400">
          Enter your username and an administrator will send you a temporary
          password.
        </p>
        <ForgotPasswordForm
          domain={domain}
          initialUsername={usernameOnly(username, domain)}
          onBack={() => setView("login")}
        />
      </div>
    );
  }

  return (
    <div key="login" className="view-fade">
      <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        Welcome back!
      </h2>
      <p className="mb-8 mt-1.5 text-[15px] text-zinc-500 dark:text-zinc-400">
        Sign in to access your projects and resources
      </p>
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
              className={`${bareInput} px-3`}
            />
            <span className="flex h-full shrink-0 select-none items-center border-l border-zinc-200 bg-zinc-50 px-4 text-sm font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              @{domain}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="password"
            className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
          >
            Password
          </label>
          <div className={fieldClass}>
            <Lock
              size={18}
              strokeWidth={1.75}
              className="ml-4 shrink-0 text-zinc-400"
              aria-hidden
            />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${bareInput} px-3`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              {showPassword ? (
                <EyeOff size={18} strokeWidth={1.75} />
              ) : (
                <Eye size={18} strokeWidth={1.75} />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 text-sm">
          <label className="flex cursor-pointer items-center gap-2 text-zinc-600 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 accent-orange-600"
            />
            Remember me
          </label>
          <button
            type="button"
            onClick={() => setView("forgot")}
            className="font-medium text-orange-600 hover:text-orange-700"
          >
            Forgot password?
          </button>
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
              Signing in…
            </>
          ) : (
            <>
              Sign in
              <ArrowRight size={16} strokeWidth={2} />
            </>
          )}
        </button>
      </form>
    </div>
  );
}

/** The part before "@", so a full address typed on the login form isn't doubled up with the fixed domain suffix. */
function usernameOnly(value: string, domain: string): string {
  const v = value.trim();
  return v.toLowerCase().endsWith("@" + domain.toLowerCase())
    ? v.slice(0, v.length - domain.length - 1)
    : v;
}
