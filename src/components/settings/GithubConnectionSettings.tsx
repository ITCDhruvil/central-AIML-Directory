"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { githubConnectHref } from "@/components/GitHubConnectPrompt";
import { GithubIcon } from "@/components/icons/GithubIcon";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { Button } from "@/components/ui/Button";

type Status = { connected: boolean; login: string | null; configured: boolean };

const RESULT_MESSAGES: Record<string, string> = {
  connected: "GitHub connected.",
  denied: "GitHub access was not approved, so nothing was connected.",
  error: "Could not connect GitHub. Please try again.",
  not_configured: "GitHub sign-in is not set up on this server yet. Ask an admin to add the GitHub OAuth app.",
};

export function GithubConnectionSettings() {
  const result = useSearchParams().get("github");
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/github/connection")
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((body: Status) => setStatus(body))
      .catch(() => setError("Could not load your GitHub connection status. Please refresh to try again."));
  }, []);

  async function disconnect() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/github/connection", { method: "DELETE" });
      if (!res.ok) throw new Error();
      setStatus((prev) => (prev ? { ...prev, connected: false, login: null } : prev));
    } catch {
      setError("Could not disconnect. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsCard
      title="GitHub"
      description="Connect your own GitHub account to import and sync repositories. Imports only reach repositories your account can open."
    >
      {result && RESULT_MESSAGES[result] && (
        <p className={`mb-3 text-sm ${result === "connected" ? "text-green-600" : "text-red-600"}`}>
          {RESULT_MESSAGES[result]}
        </p>
      )}
      {!status ? (
        !error && <p className="text-sm text-zinc-500">Loading…</p>
      ) : status.connected ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            Connected as <span className="font-medium">{status.login}</span>
          </p>
          <Button variant="danger" size="sm" loading={busy} onClick={disconnect}>
            Disconnect
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Not connected.</p>
          <Button variant="primary" size="sm" icon={GithubIcon} href={githubConnectHref("/settings")} external>
            Connect GitHub
          </Button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </SettingsCard>
  );
}
