"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AvatarEditor } from "@/components/settings/AvatarEditor";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/auth/permissionLabels";
import type { AuthUser } from "@/lib/auth/types";

// Fixed locale so the server and browser render the same text.
function formatWhen(iso: string | null): string {
  return iso
    ? new Date(iso).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";
}

export function ProfileSettings({
  user,
  createdAt,
  lastLoginAt,
}: {
  user: AuthUser;
  createdAt: string | null;
  lastLoginAt: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [saved, setSaved] = useState(user.name);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);

  const dirty =
    name.trim().replace(/\s+/g, " ") !== saved && name.trim() !== "";

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!dirty) return;
    setPending(true);
    setMessage(null);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        name?: string;
      };
      if (!res.ok || !body.name) {
        setMessage({
          kind: "error",
          text: body.error ?? "Could not save your name.",
        });
        return;
      }
      setSaved(body.name);
      setName(body.name);
      setMessage({ kind: "ok", text: "Name updated." });
      router.refresh(); // sidebar and profile menu read the name from the server
    } catch {
      setMessage({ kind: "error", text: "Network error. Try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <SettingsCard
        title="Profile"
        description="How you appear to others in the directory."
      >
        <div className="mb-6 space-y-4">
          <AvatarEditor user={user} name={saved} />
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {saved}
            </p>
            <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
              {user.email}
            </p>
          </div>
        </div>

        <form onSubmit={save} className="max-w-2xl space-y-4" noValidate>
          <div className="space-y-1.5">
            <label
              htmlFor="display-name"
              className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
            >
              Display name
            </label>
            <input
              id="display-name"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              className="h-11 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition-colors focus:border-orange-500 focus:ring-4 focus:ring-orange-500/15 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="account-email"
              className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
            >
              Email
            </label>
            <input
              id="account-email"
              value={user.email}
              readOnly
              className="h-11 w-full cursor-not-allowed rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-500 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400"
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Your email is your sign-in. Ask an administrator to change it.
            </p>
          </div>

          {message && (
            <p
              role={message.kind === "error" ? "alert" : "status"}
              className={
                message.kind === "error"
                  ? "text-sm text-red-600 dark:text-red-400"
                  : "text-sm text-emerald-600 dark:text-emerald-400"
              }
            >
              {message.text}
            </p>
          )}

          <button
            type="submit"
            disabled={!dirty || pending}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-orange-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending && <Loader2 size={15} className="animate-spin" />}
            Save changes
          </button>
        </form>
      </SettingsCard>

      <SettingsCard
        title="Account"
        description="Details an administrator manages for you."
      >
        <dl className="grid gap-x-8 gap-y-5 text-sm">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              Role
            </dt>
            <dd className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">
              {ROLE_LABELS[user.role]}
            </dd>
            <dd className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {ROLE_DESCRIPTIONS[user.role]}
            </dd>
          </div>
          <div className="space-y-4">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                Last sign-in
              </dt>
              <dd
                className="mt-1 text-zinc-900 dark:text-zinc-100"
                suppressHydrationWarning
              >
                {formatWhen(lastLoginAt)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                Member since
              </dt>
              <dd
                className="mt-1 text-zinc-900 dark:text-zinc-100"
                suppressHydrationWarning
              >
                {formatWhen(createdAt)}
              </dd>
            </div>
          </div>
        </dl>
      </SettingsCard>
    </div>
  );
}
