"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles, Undo2 } from "lucide-react";
import {
  PROJECT_STAGES,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  type Project,
  type ProjectInput,
  type ProjectStage,
} from "@/types/project";
import type { DocumentInput } from "@/types/documentation";
import type { Technology } from "@/types/technology";
import type { AutofillFieldTarget, AutofillTarget } from "@/lib/ai/importAutofillPrompts";
import { parseGitHubRepoUrl } from "@/lib/github/parseUrl";
import { TechnologyEditor } from "@/components/TechnologyEditor";
import { Dropdown } from "@/components/ui/Dropdown";
import { OwnerSelect } from "@/components/ui/OwnerSelect";
import { Button } from "@/components/ui/Button";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { cn } from "@/lib/cn";
import { STATUS_ICONS, TYPE_ICONS } from "@/lib/projectOptionIcons";
import { hasInternalDeployment } from "@/lib/deploymentLabel";

const TYPE_OPTIONS = PROJECT_TYPES.map((t) => ({ value: t, label: t, icon: TYPE_ICONS[t].icon, iconClassName: TYPE_ICONS[t].className }));
const STATUS_OPTIONS = PROJECT_STATUSES.map((s) => ({ value: s, label: s, icon: STATUS_ICONS[s].icon, iconClassName: STATUS_ICONS[s].className }));
const STAGE_OPTIONS = [
  { value: "", label: "Not set" },
  ...PROJECT_STAGES.map((s) => ({ value: s, label: s })),
];

function toCsv(values: string[]): string {
  return values.join(", ");
}

function fromCsv(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function mergeSuggestedTechnologies(prev: Technology[], suggested: string[]): Technology[] {
  const existing = new Set(prev.map((t) => t.name.toLowerCase()));
  const next = [...prev];
  for (const techName of suggested) {
    const trimmed = techName.trim();
    if (!trimmed || existing.has(trimmed.toLowerCase())) continue;
    next.push({ name: trimmed, category: "OTHER", evidence: ["ai-suggested"], confidence: "MEDIUM" });
    existing.add(trimmed.toLowerCase());
  }
  return next;
}

function Field({
  label,
  hint,
  span,
  action,
  grow,
  children,
}: {
  label: string;
  hint?: string;
  span?: string;
  action?: React.ReactNode;
  /** When true, the control stretches to fill remaining column height (used for Description). */
  grow?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(span, grow && "flex h-full min-h-0 flex-col")}>
      <div className="flex shrink-0 items-center justify-between gap-2">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {label} {hint && <span className="font-normal text-zinc-400">{hint}</span>}
        </label>
        {action}
      </div>
      <div className={cn("mt-1", grow && "flex min-h-0 flex-1 flex-col")}>{children}</div>
    </div>
  );
}

function AiFieldActions({
  target,
  canAutofill,
  loadingTarget,
  canUndo,
  onFill,
  onUndo,
  inline,
}: {
  target: AutofillFieldTarget;
  canAutofill: boolean;
  loadingTarget: AutofillTarget | null;
  canUndo: boolean;
  onFill: (target: AutofillFieldTarget) => void;
  onUndo: (target: AutofillFieldTarget) => void;
  /** Renders as a static inline group (e.g. next to a label) instead of absolutely positioned over the field. */
  inline?: boolean;
}) {
  const loading = loadingTarget === target;
  return (
    <div className={inline ? "flex items-center gap-0.5" : "absolute right-1.5 top-1.5 flex items-center gap-0.5"}>
      {canUndo && (
        <button
          type="button"
          onClick={() => onUndo(target)}
          title="Undo AI fill"
          aria-label={`Undo AI fill for ${target}`}
          className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <Undo2 size={14} />
        </button>
      )}
      <button
        type="button"
        onClick={() => onFill(target)}
        disabled={!canAutofill || loadingTarget !== null}
        title={canAutofill ? `Fill ${target} with AI` : "Connect GitHub first"}
        aria-label={`Fill ${target} with AI`}
        className={cn(
          "rounded p-1",
          canAutofill
            ? "text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-500/10"
            : "cursor-not-allowed text-zinc-300 dark:text-zinc-600",
          loading && "animate-pulse",
        )}
      >
        <Sparkles size={14} />
      </button>
    </div>
  );
}

export function ProjectForm({
  project,
  initial,
  documents,
  readmeContent,
  cancelHref,
}: {
  project?: Project;
  /** Prefill values from a GitHub import preview (not yet saved). */
  initial?: Partial<ProjectInput>;
  /** Discovered documentation from a GitHub import, saved alongside the project on create. */
  documents?: DocumentInput[];
  /** The imported repo's README text — only present right after a GitHub import. Powers per-field AI fill. */
  readmeContent?: string;
  cancelHref: string;
}) {
  const router = useRouter();
  const isEdit = Boolean(project);
  const seed = project ?? initial;
  const githubUrlInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(seed?.name ?? "");
  const [description, setDescription] = useState(seed?.description ?? "");
  const [type, setType] = useState(seed?.type ?? "PROJECT");
  const [status, setStatus] = useState(seed?.status ?? "ACTIVE");
  // Create defaults to IDEA; edit keeps unset stage as "" → null on save.
  const [stage, setStage] = useState(seed?.stage ?? (isEdit ? "" : "IDEA"));
  const [owner, setOwner] = useState(seed?.owner ?? "");
  const [githubUrl, setGithubUrl] = useState(seed?.githubUrl ?? "");
  // Carried from import/edit; also derived from a typed GitHub URL so AI works without a prior import.
  const parsedGithub = parseGitHubRepoUrl(githubUrl);
  const githubOwner = seed?.githubOwner || parsedGithub?.owner || "";
  const githubRepo = seed?.githubRepo || parsedGithub?.repo || "";
  const defaultBranch = seed?.defaultBranch ?? "";
  const [technologies, setTechnologies] = useState<Technology[]>(seed?.technologies ?? []);
  const [tags, setTags] = useState(toCsv(seed?.tags ?? []));
  const [deploymentUrls, setDeploymentUrls] = useState(toCsv(seed?.deploymentUrls ?? []));

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [loadingTarget, setLoadingTarget] = useState<AutofillTarget | null>(null);
  const [autofillError, setAutofillError] = useState<string | null>(null);
  const [connectGithubHint, setConnectGithubHint] = useState(false);
  const [undoName, setUndoName] = useState<string | null>(null);
  const [undoDescription, setUndoDescription] = useState<string | null>(null);
  const [undoTags, setUndoTags] = useState<string | null>(null);
  const [undoTechnologies, setUndoTechnologies] = useState<Technology[] | null>(null);

  // Enabled whenever a GitHub repo is known — README is fetched by the API if not already in memory.
  const canAutofill = Boolean(githubOwner && githubRepo);
  const canUndoAll =
    undoName !== null || undoDescription !== null || undoTags !== null || undoTechnologies !== null;

  function clearUndo(target: AutofillFieldTarget) {
    if (target === "name") setUndoName(null);
    if (target === "description") setUndoDescription(null);
    if (target === "tags") setUndoTags(null);
    if (target === "technologies") setUndoTechnologies(null);
  }

  function handleUndo(target: AutofillFieldTarget) {
    if (target === "name" && undoName !== null) {
      setName(undoName);
      setUndoName(null);
    } else if (target === "description" && undoDescription !== null) {
      setDescription(undoDescription);
      setUndoDescription(null);
    } else if (target === "tags" && undoTags !== null) {
      setTags(undoTags);
      setUndoTags(null);
    } else if (target === "technologies" && undoTechnologies !== null) {
      setTechnologies(undoTechnologies);
      setUndoTechnologies(null);
    }
  }

  function handleUndoAll() {
    if (undoName !== null) setName(undoName);
    if (undoDescription !== null) setDescription(undoDescription);
    if (undoTags !== null) setTags(undoTags);
    if (undoTechnologies !== null) setTechnologies(undoTechnologies);
    setUndoName(null);
    setUndoDescription(null);
    setUndoTags(null);
    setUndoTechnologies(null);
  }

  function promptConnectGithub() {
    setConnectGithubHint(true);
    setAutofillError(null);
    githubUrlInputRef.current?.focus();
    githubUrlInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function requestAutofill(target: AutofillTarget, onlyFill?: AutofillFieldTarget[]) {
    const res = await fetch("/api/projects/import/github/autofill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target,
        repoFullName: `${githubOwner}/${githubRepo}`,
        existingName: name || null,
        existingDescription: description || null,
        existingTags: fromCsv(tags),
        readme: readmeContent ?? "",
        detectedTechnologies: technologies.map((t) => t.name),
        ...(onlyFill ? { onlyFill } : {}),
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      throw new Error(typeof body.error === "string" ? body.error : "Failed to auto-fill");
    }
    return body as Record<string, unknown>;
  }

  function emptyAutofillFields(): AutofillFieldTarget[] {
    const fields: AutofillFieldTarget[] = [];
    if (!name.trim()) fields.push("name");
    if (!description.trim()) fields.push("description");
    if (fromCsv(tags).length === 0) fields.push("tags");
    if (technologies.length === 0) fields.push("technologies");
    return fields;
  }

  async function handleFieldAutofill(target: AutofillFieldTarget) {
    if (!canAutofill) {
      promptConnectGithub();
      return;
    }
    setLoadingTarget(target);
    setAutofillError(null);
    setConnectGithubHint(false);
    try {
      const body = await requestAutofill(target);

      if (target === "name" && typeof body.name === "string") {
        setUndoName(name);
        setName(body.name);
      } else if (target === "description" && typeof body.description === "string") {
        setUndoDescription(description);
        setDescription(body.description);
      } else if (target === "tags" && Array.isArray(body.tags)) {
        setUndoTags(tags);
        setTags(toCsv(body.tags as string[]));
      } else if (target === "technologies" && Array.isArray(body.suggestedTechnologies)) {
        const suggested = (body.suggestedTechnologies as string[]).map((t) => t.trim()).filter(Boolean);
        if (suggested.length === 0) {
          setAutofillError("No additional technologies found in the README.");
          return;
        }
        setUndoTechnologies(technologies);
        setTechnologies((prev) => mergeSuggestedTechnologies(prev, suggested));
      }
    } catch (error) {
      setAutofillError(error instanceof Error ? error.message : "Network error — please try again");
    } finally {
      setLoadingTarget(null);
    }
  }

  async function handleAutofillAll() {
    if (!canAutofill) {
      promptConnectGithub();
      return;
    }

    const onlyFill = emptyAutofillFields();
    if (onlyFill.length === 0) {
      setAutofillError("All AI-fillable fields already have values. Clear a field to auto-fill it, or use a field sparkle to replace it.");
      return;
    }

    setLoadingTarget("all");
    setAutofillError(null);
    setConnectGithubHint(false);
    try {
      const body = await requestAutofill("all", onlyFill);
      const fill = new Set(onlyFill);

      if (fill.has("name") && typeof body.name === "string" && body.name.trim()) {
        setUndoName(name);
        setName(body.name);
      }
      if (fill.has("description") && typeof body.description === "string" && body.description.trim()) {
        setUndoDescription(description);
        setDescription(body.description);
      }
      if (fill.has("tags") && Array.isArray(body.tags)) {
        setUndoTags(tags);
        setTags(toCsv(body.tags as string[]));
      }
      if (fill.has("technologies") && Array.isArray(body.suggestedTechnologies)) {
        const suggested = (body.suggestedTechnologies as string[]).map((t) => t.trim()).filter(Boolean);
        if (suggested.length > 0) {
          setUndoTechnologies(technologies);
          setTechnologies((prev) => mergeSuggestedTechnologies(prev, suggested));
        }
      }
    } catch (error) {
      setAutofillError(error instanceof Error ? error.message : "Network error — please try again");
    } finally {
      setLoadingTarget(null);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});
    setFormError(null);

    const payload: ProjectInput & { documents?: DocumentInput[] } = {
      name,
      description: description || null,
      type: type as ProjectInput["type"],
      status: status as ProjectInput["status"],
      stage: stage ? (stage as ProjectStage) : null,
      owner: owner.trim() || null,
      githubUrl: githubUrl || null,
      githubOwner: githubOwner || null,
      githubRepo: githubRepo || null,
      defaultBranch: defaultBranch || null,
      technologies,
      tags: fromCsv(tags),
      deploymentUrls: fromCsv(deploymentUrls),
    };

    if (!isEdit && documents && documents.length > 0) {
      payload.documents = documents;
    }

    try {
      const res = await fetch(isEdit ? `/api/projects/${project!.id}` : "/api/projects", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.details) setErrors(body.details);
        setFormError(body.error ?? "Something went wrong");
        setSubmitting(false);
        return;
      }

      const body = await res.json();
      router.push(`/projects/${body.project.id}`);
      router.refresh();
    } catch {
      setFormError("Network error — please try again");
      setSubmitting(false);
    }
  }

  const aiProps = {
    canAutofill,
    loadingTarget,
    onFill: handleFieldAutofill,
    onUndo: handleUndo,
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 lg:min-h-[calc(100vh-8.5rem)]"
    >
      {formError && (
        <p className="mb-5 shrink-0 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {formError}
        </p>
      )}

      <div
        className={cn(
          "mb-5 flex shrink-0 flex-wrap items-center gap-3 rounded-md border px-3 py-2.5",
          connectGithubHint && !canAutofill
            ? "border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10"
            : "border-orange-200 bg-orange-50 dark:border-orange-500/30 dark:bg-orange-500/10",
        )}
      >
        <Sparkles
          size={16}
          className={cn(
            "shrink-0",
            connectGithubHint && !canAutofill
              ? "text-amber-600 dark:text-amber-400"
              : "text-orange-600 dark:text-orange-400",
          )}
        />
        <p className="min-w-0 flex-1 text-sm text-zinc-700 dark:text-zinc-300">
          {canAutofill
            ? "Auto-fill all only fills empty Name, Description, Tags, and Technologies from the GitHub README. Already filled fields are left alone. Field sparkles can still replace a single field."
            : connectGithubHint
              ? "Connect GitHub first — paste a repository URL below (or import from GitHub), then run Auto-fill all."
              : "Connect a GitHub repository to enable AI auto-fill for Name, Description, Tags, and Technologies."}
        </p>
        <div className="flex flex-wrap gap-2">
          {canUndoAll && (
            <Button type="button" variant="secondary" size="sm" icon={Undo2} onClick={handleUndoAll}>
              Undo all
            </Button>
          )}
          <Button
            type="button"
            variant="primary"
            size="sm"
            icon={Sparkles}
            loading={loadingTarget === "all"}
            disabled={loadingTarget !== null && loadingTarget !== "all"}
            onClick={handleAutofillAll}
          >
            {loadingTarget === "all" ? "Filling..." : canAutofill ? "Auto-fill all" : "Connect GitHub first"}
          </Button>
        </div>
      </div>
      {autofillError && <p className="mb-5 shrink-0 text-sm text-red-600">{autofillError}</p>}

      {/* Two columns on large screens: metadata left, description fills remaining height on the right. */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-2 lg:items-stretch lg:gap-6">
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Project Name" span="sm:col-span-1">
              <div className="relative">
                <input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    clearUndo("name");
                  }}
                  className="field w-full pr-16"
                />
                <AiFieldActions target="name" canUndo={undoName !== null} {...aiProps} />
              </div>
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
            </Field>

            <Field label="GitHub URL">
              <input
                ref={githubUrlInputRef}
                value={githubUrl}
                onChange={(e) => {
                  setGithubUrl(e.target.value);
                  if (parseGitHubRepoUrl(e.target.value)) setConnectGithubHint(false);
                }}
                placeholder="https://github.com/owner/repo"
                className={cn(
                  "field w-full",
                  connectGithubHint && !canAutofill && "border-amber-400 ring-2 ring-amber-400/40",
                )}
              />
              {errors.githubUrl && <p className="mt-1 text-xs text-red-600">{errors.githubUrl}</p>}
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <Field label="Type">
              <Dropdown value={type} onChange={(v) => setType(v as ProjectInput["type"])} options={TYPE_OPTIONS} className="w-full" />
              {errors.type && <p className="mt-1 text-xs text-red-600">{errors.type}</p>}
            </Field>

            <Field label="Status">
              <Dropdown value={status} onChange={(v) => setStatus(v as ProjectInput["status"])} options={STATUS_OPTIONS} className="w-full" />
              {errors.status && <p className="mt-1 text-xs text-red-600">{errors.status}</p>}
            </Field>

            <Field label="Stage">
              <Dropdown value={stage} onChange={setStage} options={STAGE_OPTIONS} className="w-full" />
              {errors.stage && <p className="mt-1 text-xs text-red-600">{errors.stage}</p>}
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Owner" hint="(optional)">
              <OwnerSelect value={owner} onChange={setOwner} className="w-full" />
              {errors.owner && <p className="mt-1 text-xs text-red-600">{errors.owner}</p>}
            </Field>

            <Field label="Tags" hint="(comma-separated)">
              <div className="relative">
                <input
                  value={tags}
                  onChange={(e) => {
                    setTags(e.target.value);
                    clearUndo("tags");
                  }}
                  placeholder="internal, dashboard"
                  className="field w-full pr-16"
                />
                <AiFieldActions target="tags" canUndo={undoTags !== null} {...aiProps} />
              </div>
            </Field>
          </div>

          <Field label="Technologies">
            <TechnologyEditor
              value={technologies}
              onChange={(next) => {
                setTechnologies(next);
                clearUndo("technologies");
              }}
              endAdornment={<AiFieldActions target="technologies" canUndo={undoTechnologies !== null} {...aiProps} />}
            />
          </Field>

          <Field label="Deployment URLs" hint="(comma-separated)">
            <input
              value={deploymentUrls}
              onChange={(e) => setDeploymentUrls(e.target.value)}
              placeholder="https://app.example.com"
              className="field w-full"
            />
            {hasInternalDeployment(fromCsv(deploymentUrls)) && (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                Internal URL detected — VPN or remote access required.
              </p>
            )}
            {errors.deploymentUrls && <p className="mt-1 text-xs text-red-600">{errors.deploymentUrls}</p>}
          </Field>
        </div>

        <div className="flex min-h-[20rem] flex-col lg:h-full lg:min-h-0">
          <Field
            label="Description"
            hint="(Markdown)"
            grow
            action={<AiFieldActions target="description" canUndo={undoDescription !== null} inline {...aiProps} />}
          >
            <RichTextEditor
              value={description ?? ""}
              onChange={(markdown) => {
                setDescription(markdown);
                clearUndo("description");
              }}
              placeholder="Short summary of the project"
              className="h-full min-h-[20rem] flex-1 lg:min-h-0"
            />
          </Field>
        </div>
      </div>

      <div className={cn("mt-6 flex shrink-0 gap-2 border-t border-zinc-100 pt-5 dark:border-zinc-800")}>
        <Button type="submit" variant="primary" icon={Check} loading={submitting}>
          {submitting ? "Saving..." : isEdit ? "Save Changes" : "Create Project"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.push(cancelHref)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
