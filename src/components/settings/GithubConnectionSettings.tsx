"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { githubConnectHref } from "@/components/GitHubConnectPrompt";
import { GithubIcon } from "@/components/icons/GithubIcon";
import { GithubReposTable } from "@/components/settings/GithubReposTable";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/formatDate";
import type { GithubConnectionDetails } from "@/types/github";

const RESULT_MESSAGES: Record<string, { text: string; ok: boolean }> = {
  connected: { text: "GitHub connected.", ok: true },
  denied: { text: "GitHub access was not approved, so nothing was connected.", ok: false },
  error: { text: "Could not connect GitHub. Please try again.", ok: false },
  not_configured: {
    text: "GitHub sign-in is not set up on this server yet. Ask an admin to add the GitHub OAuth app.",
    ok: false,
  },
};

const RETURN_TO = "/settings";

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">{children}</dd>
    </div>
  );
}

function Avatar({ details }: { details: GithubConnectionDetails }) {
  const url = details.profile?.avatarUrl;
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="size-12 shrink-0 rounded-full border border-zinc-200 dark:border-zinc-700" />
  ) : (
    <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
      <GithubIcon size={22} />
    </span>
  );
}

function StatusPill({ state }: { state: GithubConnectionDetails["state"] }) {
  const expired = state === "expired";
  return (
    <span
      className={
        expired
          ? "inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300"
          : "inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-300"
      }
    >
      <span className={`size-1.5 rounded-full ${expired ? "bg-amber-500" : "bg-green-500"}`} />
      {expired ? "Needs reconnecting" : "Connected"}
    </span>
  );
}

function Connected({
  details,
  onDisconnect,
  onExpired,
  busy,
}: {
  details: GithubConnectionDetails;
  onDisconnect: () => void;
  onExpired: () => void;
  busy: boolean;
}) {
  const { profile, login, scopes = [], connectedAt, state } = details;
  const canReadPrivate = scopes.includes("repo");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar details={details} />
          <div className="min-w-0">
            {profile?.name && (
              <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{profile.name}</p>
            )}
            <a
              href={profile?.profileUrl ?? `https://github.com/${login}`}
              target="_blank"
              rel="noopener noreferrer"
              className={
                profile?.name
                  ? "inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                  : "inline-flex items-center gap-1 text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-100"
              }
            >
              @{login}
              <ExternalLink size={12} />
            </a>
          </div>
        </div>
        <StatusPill state={state} />
      </div>

      {state === "expired" && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <p>GitHub no longer accepts this connection. Reconnect to keep importing and syncing repositories.</p>
        </div>
      )}
      {state === "unavailable" && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Could not reach GitHub just now, so only saved details are shown.
        </p>
      )}

      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 border-t border-zinc-100 pt-5 dark:border-zinc-800 sm:grid-cols-2">
        {connectedAt && <Fact label="Connected since">{formatDate(connectedAt)}</Fact>}
        {profile && <Fact label="Public repositories">{profile.publicRepos}</Fact>}
        <Fact label="Can access">{canReadPrivate ? "Public and private repositories" : "Public repositories only"}</Fact>
        <Fact label="Permission granted">
          <span className="flex flex-wrap gap-1.5">
            {scopes.length > 0 ? (
              scopes.map((scope) => (
                <code
                  key={scope}
                  className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  {scope}
                </code>
              ))
            ) : (
              <span className="text-zinc-500">None recorded</span>
            )}
          </span>
        </Fact>
      </dl>

      {state !== "expired" && (
        <div className="border-t border-zinc-100 pt-5 dark:border-zinc-800">
          <GithubReposTable onExpired={onExpired} />
        </div>
      )}

      <p className="flex items-start gap-2 rounded-lg bg-zinc-50 px-3 py-2.5 text-xs leading-relaxed text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400">
        <ShieldCheck size={14} className="mt-0.5 shrink-0" />
        <span>
          Your token is stored encrypted and is only used to read repositories when you import or sync a project. Nothing is
          written to GitHub. You can also revoke access any time at github.com/settings/applications.
        </span>
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="secondary"
          size="sm"
          icon={RefreshCw}
          href={githubConnectHref(RETURN_TO)}
          external
        >
          Reconnect
        </Button>
        <Button variant="danger" size="sm" loading={busy} onClick={onDisconnect}>
          Disconnect
        </Button>
      </div>
    </div>
  );
}

function NotConnected({ configured }: { configured: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-800">
          <GithubIcon size={22} />
        </span>
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Not connected</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-zinc-500 dark:text-zinc-400">
            <li>Import a repository as a project</li>
            <li>Sync its README and docs later</li>
            <li>Reach your private repositories</li>
          </ul>
          {!configured && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              GitHub sign-in is not set up on this server yet.
            </p>
          )}
        </div>
      </div>
      <Button variant="primary" icon={GithubIcon} href={githubConnectHref(RETURN_TO)} external>
        Connect GitHub
      </Button>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex animate-pulse items-center gap-3">
      <div className="size-12 rounded-full bg-zinc-200 dark:bg-zinc-800" />
      <div className="space-y-2">
        <div className="h-3 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-3 w-20 rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>
    </div>
  );
}

export function GithubConnectionSettings() {
  const result = RESULT_MESSAGES[useSearchParams().get("github") ?? ""];
  const [details, setDetails] = useState<GithubConnectionDetails | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/github/connection")
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((body: GithubConnectionDetails) => setDetails(body))
      .catch(() => setError("Could not load your GitHub connection status. Please refresh to try again."));
  }, []);

  async function disconnect() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/github/connection", { method: "DELETE" });
      if (!res.ok) throw new Error();
      setDetails((prev) => (prev ? { connected: false, configured: prev.configured } : prev));
    } catch {
      setError("Could not disconnect. Please try again.");
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  }

  return (
    <SettingsCard
      title="GitHub"
      description="Connect your own GitHub account to import and sync repositories. Imports only reach repositories your account can open."
    >
      {result && (
        <p className={`mb-4 text-sm ${result.ok ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
          {result.text}
        </p>
      )}
      {!details ? (
        !error && <Loading />
      ) : details.connected ? (
        <Connected
          details={details}
          busy={busy}
          onDisconnect={() => setConfirmOpen(true)}
          onExpired={() => setDetails((prev) => (prev ? { ...prev, state: "expired" } : prev))}
        />
      ) : (
        <NotConnected configured={details.configured} />
      )}
      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <ConfirmDialog
        open={confirmOpen}
        title="Disconnect GitHub?"
        description="Your stored token is deleted. You will need to connect again before importing or syncing repositories. Projects you already imported are not affected."
        confirmLabel="Disconnect"
        loading={busy}
        onConfirm={disconnect}
        onCancel={() => setConfirmOpen(false)}
      />
    </SettingsCard>
  );
}
