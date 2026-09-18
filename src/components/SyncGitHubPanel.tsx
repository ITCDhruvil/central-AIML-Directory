"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { SyncPreview } from "@/lib/github/sync/types";

function formatDateTime(iso: string): string {
  // A fixed locale (instead of `undefined`, which follows the runtime's own
  // locale) keeps server and client output identical — otherwise Node's OS
  // locale and the browser's locale can format the same Date differently,
  // causing a hydration mismatch.
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function hasAnyChanges(preview: SyncPreview): boolean {
  return (
    preview.repository.changed ||
    preview.readme.changed ||
    preview.documents.added.length > 0 ||
    preview.documents.modified.length > 0 ||
    preview.documents.removed.length > 0 ||
    preview.technologies.added.length > 0 ||
    preview.technologies.removed.length > 0 ||
    preview.technologies.changed.length > 0 ||
    preview.setupGuide.changed
  );
}

export function SyncGitHubPanel({ projectId, lastSyncedAt }: { projectId: string; lastSyncedAt: string | null }) {
  const router = useRouter();
  const [preview, setPreview] = useState<SyncPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [applyRepository, setApplyRepository] = useState(true);
  const [applyReadme, setApplyReadme] = useState(true);
  const [applyDocuments, setApplyDocuments] = useState(true);
  const [applyTechnologies, setApplyTechnologies] = useState(true);
  const [applySetupGuide, setApplySetupGuide] = useState(true);

  async function startSync() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/sync/github`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Failed to sync with GitHub");
        return;
      }
      const result = body as SyncPreview;
      setPreview(result);
      setApplyRepository(result.repository.changed);
      setApplyReadme(result.readme.changed);
      setApplyDocuments(
        result.documents.added.length > 0 || result.documents.modified.length > 0 || result.documents.removed.length > 0,
      );
      setApplyTechnologies(
        result.technologies.added.length > 0 ||
          result.technologies.removed.length > 0 ||
          result.technologies.changed.length > 0,
      );
      setApplySetupGuide(result.setupGuide.changed && !result.setupGuide.userModified);
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  async function applySync() {
    if (!preview) return;
    setApplying(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/sync/github/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectUpdatedAt: preview.projectUpdatedAt,
          applyRepositoryMetadata: applyRepository,
          applyReadme,
          documents: {
            add: applyDocuments ? preview.documents.added.map((d) => d.filePath) : [],
            update: applyDocuments ? preview.documents.modified.map((d) => d.filePath) : [],
            remove: applyDocuments ? preview.documents.removed.map((d) => d.documentId) : [],
          },
          technologies: { applyDetectedChanges: applyTechnologies },
          setupGuide: { applyGeneratedUpdate: applySetupGuide },
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Failed to apply sync");
        if (res.status === 409) setPreview(null);
        return;
      }
      setPreview(null);
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">GitHub Sync</h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Last synced: {lastSyncedAt ? formatDateTime(lastSyncedAt) : "Never"}
          </p>
        </div>
        {!preview && (
          <Button onClick={startSync} loading={loading} icon={RefreshCw}>
            {loading ? "Syncing..." : "Sync GitHub"}
          </Button>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {preview && !hasAnyChanges(preview) && (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
          Everything is up to date.{" "}
          <button type="button" onClick={() => setPreview(null)} className="underline">
            Dismiss
          </button>
        </p>
      )}

      {preview && hasAnyChanges(preview) && (
        <div className="mt-4 space-y-4 text-sm">
          {preview.repository.changed && (
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={applyRepository}
                onChange={(e) => setApplyRepository(e.target.checked)}
                className="mt-0.5 rounded border-zinc-300 text-orange-600 focus:ring-orange-500 dark:border-zinc-700"
              />
              <span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">Repository metadata changed</span>
                <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                  {preview.repository.current.defaultBranch ?? "(none)"} → {preview.repository.incoming.defaultBranch}
                  {preview.repository.current.githubOwner !== preview.repository.incoming.githubOwner ||
                  preview.repository.current.githubRepo !== preview.repository.incoming.githubRepo
                    ? ` · ${preview.repository.current.githubOwner}/${preview.repository.current.githubRepo} → ${preview.repository.incoming.githubOwner}/${preview.repository.incoming.githubRepo}`
                    : ""}
                </span>
              </span>
            </label>
          )}

          {preview.readme.changed && (
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={applyReadme}
                onChange={(e) => setApplyReadme(e.target.checked)}
                className="mt-0.5 rounded border-zinc-300 text-orange-600 focus:ring-orange-500 dark:border-zinc-700"
              />
              <span className="font-medium text-zinc-800 dark:text-zinc-200">README changed</span>
            </label>
          )}

          {(preview.documents.added.length > 0 || preview.documents.modified.length > 0 || preview.documents.removed.length > 0) && (
            <div>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={applyDocuments}
                  onChange={(e) => setApplyDocuments(e.target.checked)}
                  className="mt-0.5 rounded border-zinc-300 text-orange-600 focus:ring-orange-500 dark:border-zinc-700"
                />
                <span className="font-medium text-zinc-800 dark:text-zinc-200">Documentation Changes</span>
              </label>
              <ul className="ml-6 mt-1 space-y-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                {preview.documents.added.map((d) => (
                  <li key={`add-${d.filePath}`}>+ Added {d.filePath}</li>
                ))}
                {preview.documents.modified.map((d) => (
                  <li key={`mod-${d.filePath}`}>~ Modified {d.filePath}</li>
                ))}
                {preview.documents.removed.map((d) => (
                  <li key={`rem-${d.documentId}`}>− Removed {d.filePath}</li>
                ))}
              </ul>
            </div>
          )}

          {(preview.technologies.added.length > 0 ||
            preview.technologies.removed.length > 0 ||
            preview.technologies.changed.length > 0) && (
            <div>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={applyTechnologies}
                  onChange={(e) => setApplyTechnologies(e.target.checked)}
                  className="mt-0.5 rounded border-zinc-300 text-orange-600 focus:ring-orange-500 dark:border-zinc-700"
                />
                <span className="font-medium text-zinc-800 dark:text-zinc-200">Technologies</span>
              </label>
              <ul className="ml-6 mt-1 space-y-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                {preview.technologies.added.map((t) => (
                  <li key={`add-${t.name}`}>+ {t.name}</li>
                ))}
                {preview.technologies.removed.map((t) => (
                  <li key={`rem-${t.name}`}>− {t.name}</li>
                ))}
                {preview.technologies.changed.map((t) => (
                  <li key={`chg-${t.name}`}>~ {t.name} (evidence updated)</li>
                ))}
              </ul>
              {preview.technologies.manual.length > 0 && (
                <p className="ml-6 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Manual (preserved): {preview.technologies.manual.map((t) => t.name).join(", ")}
                </p>
              )}
            </div>
          )}

          {preview.setupGuide.changed && (
            <div>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={applySetupGuide}
                  disabled={preview.setupGuide.userModified}
                  onChange={(e) => setApplySetupGuide(e.target.checked)}
                  className="mt-0.5 rounded border-zinc-300 text-orange-600 focus:ring-orange-500 dark:border-zinc-700"
                />
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  Setup Guide {preview.setupGuide.userModified ? "(protected — manually edited)" : "regeneration available"}
                </span>
              </label>
            </div>
          )}

          {preview.warnings.length > 0 && (
            <div className="flex items-start gap-2 rounded-md bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <div>
                {preview.warnings.map((w) => (
                  <p key={w}>{w}</p>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="primary" onClick={applySync} loading={applying}>
              {applying ? "Applying..." : "Apply Sync"}
            </Button>
            <Button variant="secondary" onClick={() => setPreview(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
