"use client";

import { useState } from "react";
import type { GitHubImportResult } from "@/types/github";
import { Button } from "@/components/ui/Button";
import { GithubIcon } from "@/components/icons/GithubIcon";

export function GitHubImportPanel({ onImported }: { onImported: (result: GitHubImportResult) => void }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleImport() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/projects/import/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubUrl: url }),
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(body.error ?? "Failed to import repository");
        return;
      }

      onImported(body as GitHubImportResult);
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        GitHub Repository URL
      </label>
      <div className="mt-1 flex flex-col gap-2 sm:flex-row">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://github.com/owner/repo"
          className="field flex-1"
        />
        <Button variant="primary" icon={GithubIcon} loading={loading} disabled={!url.trim()} onClick={handleImport}>
          {loading ? "Importing..." : "Import from GitHub"}
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <p className="mt-2 text-xs text-zinc-400">Or skip this and fill in the project details manually below.</p>
    </div>
  );
}
