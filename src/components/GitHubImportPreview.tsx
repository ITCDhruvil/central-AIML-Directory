"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Braces,
  Check,
  CheckCircle2,
  Database,
  ExternalLink,
  FileText,
  GitBranch,
  Lightbulb,
  Network,
  Sparkles,
  Undo2,
} from "lucide-react";
import type { GitHubImportResult } from "@/types/github";
import { Button } from "@/components/ui/Button";
import { GithubIcon } from "@/components/icons/GithubIcon";
import { MarkdownView } from "@/components/MarkdownView";
import { cn } from "@/lib/cn";

function formatStatusDate(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  return `${date} - ${time}`;
}

function formatStatusTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
}

const IMPORT_STEPS = [
  {
    id: "fetch",
    title: "Repository Fetch",
    description: "Cloned repository metadata and default branch from GitHub.",
    icon: Braces,
  },
  {
    id: "docs",
    title: "Read Documentation",
    description: "Located README and project documentation files.",
    icon: FileText,
  },
  {
    id: "analyze",
    title: "Analyze Structure",
    description: "Detected languages, frameworks, and supporting libraries.",
    icon: Network,
  },
  {
    id: "build",
    title: "Build Project",
    description: "Prepared project fields and generated a setup guide.",
    icon: Database,
  },
] as const;

const COMPACT_MD =
  "[&_p]:my-0 [&_p]:leading-relaxed [&_strong]:font-semibold [&_strong]:text-zinc-800 dark:[&_strong]:text-zinc-100";

export function GitHubImportPreview({
  result,
  importedAt,
  displayName,
  displayDescription,
  onDisplayNameChange,
  onDisplayDescriptionChange,
  includeSetupGuide,
  onIncludeSetupGuideChange,
  onContinue,
}: {
  result: GitHubImportResult;
  importedAt: string;
  displayName: string;
  displayDescription: string;
  onDisplayNameChange: (name: string) => void;
  onDisplayDescriptionChange: (description: string) => void;
  includeSetupGuide: boolean;
  onIncludeSetupGuideChange: (include: boolean) => void;
  onContinue: () => void;
}) {
  const { repository, technologies } = result;
  const stamp = formatStatusDate(importedAt);
  const timeStamp = formatStatusTime(importedAt);

  const [improving, setImproving] = useState<"name" | "description" | null>(null);
  const [improveError, setImproveError] = useState<string | null>(null);
  const [undoName, setUndoName] = useState<string | null>(null);
  const [undoDescription, setUndoDescription] = useState<string | null>(null);

  async function improveField(field: "name" | "description") {
    const current = field === "name" ? displayName : displayDescription;
    if (!current.trim() || improving) return;

    setImproving(field);
    setImproveError(null);
    try {
      const res = await fetch("/api/ai/transform-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: current, action: "improve" }),
      });
      const body = await res.json();
      if (!res.ok) {
        setImproveError(body.error ?? "Failed to improve text");
        return;
      }
      const next = typeof body.text === "string" ? body.text.trim() : "";
      if (!next) {
        setImproveError("AI returned empty text");
        return;
      }
      if (field === "name") {
        setUndoName(displayName);
        onDisplayNameChange(next.replace(/\n+/g, " ").slice(0, 120));
      } else {
        setUndoDescription(displayDescription);
        onDisplayDescriptionChange(next);
      }
    } catch {
      setImproveError("Network error — please try again");
    } finally {
      setImproving(null);
    }
  }

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href="/projects"
            className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            aria-label="Back to projects"
          >
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Import Repository</h1>
        </div>
        <a
          href={repository.htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
        >
          <GithubIcon size={16} />
          {repository.fullName}
          <ExternalLink size={14} className="text-zinc-400" />
        </a>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.9fr)] lg:items-start">
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center gap-4 border-b border-emerald-100 bg-emerald-50 px-5 py-4 dark:border-emerald-900/40 dark:bg-emerald-950/50">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
              <Check size={24} strokeWidth={2.5} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Repository imported successfully</p>
              <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
                The repository has been analyzed and your project is ready.
              </p>
            </div>
            <div className="text-right">
              <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                Completed
              </span>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{stamp}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-start gap-4 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
              <GithubIcon size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <a
                href={repository.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-900 hover:text-orange-600 dark:text-zinc-100 dark:hover:text-orange-400"
              >
                {displayName || repository.fullName}
                <ExternalLink size={13} className="text-zinc-400" />
              </a>
              {displayDescription.trim() ? (
                <div className={cn("mt-1 text-sm text-zinc-600 dark:text-zinc-400", COMPACT_MD)}>
                  <MarkdownView content={displayDescription} />
                </div>
              ) : null}
            </div>
            {/* Single-row branch chip — label and value stay on one line */}
            <div className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/60">
              <GitBranch size={14} className="text-zinc-400" />
              <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">Branch</span>
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{repository.defaultBranch}</span>
            </div>
          </div>

          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {IMPORT_STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <li key={step.id} className="flex items-center gap-3 px-5 py-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{step.title}</p>
                    <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{step.description}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 size={14} />
                      Completed
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-400">{timeStamp}</p>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="border-t border-zinc-100 px-5 py-3 dark:border-zinc-800">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={includeSetupGuide}
                onChange={(e) => onIncludeSetupGuideChange(e.target.checked)}
                className="rounded border-zinc-300 text-orange-600 focus:ring-orange-500 dark:border-zinc-700"
              />
              Include generated setup guide in the project
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Repository Details</h2>
            </div>
            {improveError && <p className="border-b border-zinc-100 px-5 py-2 text-xs text-red-600 dark:border-zinc-800">{improveError}</p>}
            <dl className="divide-y divide-zinc-100 dark:divide-zinc-800">
              <DetailRow
                icon={GithubIcon}
                label="Name"
                value={displayName}
                onImprove={() => improveField("name")}
                improving={improving === "name"}
                canImprove={Boolean(displayName.trim()) && improving === null}
                onUndo={
                  undoName !== null
                    ? () => {
                        onDisplayNameChange(undoName);
                        setUndoName(null);
                      }
                    : undefined
                }
              />
              <DetailRow icon={GitBranch} label="Branch" value={repository.defaultBranch} />
              <DetailRow
                icon={FileText}
                label="Description"
                markdown
                value={displayDescription.trim() ? displayDescription : "—"}
                onImprove={displayDescription.trim() ? () => improveField("description") : undefined}
                improving={improving === "description"}
                canImprove={Boolean(displayDescription.trim()) && improving === null}
                onUndo={
                  undoDescription !== null
                    ? () => {
                        onDisplayDescriptionChange(undoDescription);
                        setUndoDescription(null);
                      }
                    : undefined
                }
              />
              <DetailRow icon={CheckCircle2} label="Last Updated" value={stamp} />
              <div className="flex gap-3 px-5 py-3">
                <ExternalLink size={16} className="mt-0.5 shrink-0 text-zinc-400" />
                <div className="min-w-0">
                  <dt className="text-xs font-medium text-zinc-400">Repository URL</dt>
                  <dd className="mt-0.5">
                    <a
                      href={repository.htmlUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-sm font-medium text-orange-600 hover:underline dark:text-orange-400"
                    >
                      {repository.htmlUrl}
                    </a>
                  </dd>
                </div>
              </div>
            </dl>
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center gap-2 border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Detected Technologies</h2>
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700 dark:bg-sky-500/20 dark:text-sky-300">
                {technologies.length}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 p-5">
              {technologies.length === 0 ? (
                <p className="text-sm text-zinc-400">No technologies detected</p>
              ) : (
                technologies.map((t) => (
                  <span
                    key={t.name}
                    title={t.evidence.length > 0 ? `Evidence: ${t.evidence.join(", ")}` : undefined}
                    className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-800 dark:bg-sky-500/10 dark:text-sky-300"
                  >
                    {t.name}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-sky-100 bg-sky-50 px-5 py-4 dark:border-sky-900/40 dark:bg-sky-950/40">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-300">
              <Lightbulb size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Project is ready</p>
              <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
                You can now view, edit or start working on this project.
              </p>
            </div>
            <Button type="button" variant="primary" icon={ExternalLink} onClick={onContinue}>
              View Project
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
  markdown,
  onImprove,
  canImprove,
  improving,
  onUndo,
}: {
  icon: React.ElementType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  markdown?: boolean;
  onImprove?: () => void;
  canImprove?: boolean;
  improving?: boolean;
  onUndo?: () => void;
}) {
  return (
    <div className="flex gap-3 px-5 py-3">
      <Icon size={16} className="mt-0.5 shrink-0 text-zinc-400" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-xs font-medium text-zinc-400">{label}</dt>
          {(onImprove || onUndo) && (
            <div className="flex items-center gap-0.5">
              {onUndo && (
                <button
                  type="button"
                  onClick={onUndo}
                  title={`Undo ${label.toLowerCase()} improve`}
                  aria-label={`Undo ${label.toLowerCase()} improve`}
                  className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                >
                  <Undo2 size={14} />
                </button>
              )}
              {onImprove && (
                <button
                  type="button"
                  onClick={onImprove}
                  disabled={!canImprove}
                  title={`Improve ${label.toLowerCase()}`}
                  aria-label={`Improve ${label.toLowerCase()}`}
                  className={cn(
                    "rounded p-1",
                    canImprove
                      ? "text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-500/10"
                      : "cursor-not-allowed text-zinc-300 dark:text-zinc-600",
                    improving && "animate-pulse",
                  )}
                >
                  <Sparkles size={14} />
                </button>
              )}
            </div>
          )}
        </div>
        <dd className="mt-0.5 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          {markdown && value !== "—" ? (
            <div className={COMPACT_MD}>
              <MarkdownView content={value} />
            </div>
          ) : (
            value
          )}
        </dd>
      </div>
    </div>
  );
}
