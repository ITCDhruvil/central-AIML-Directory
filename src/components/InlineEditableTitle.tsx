"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, X } from "lucide-react";
import type { Project, ProjectInput } from "@/types/project";

/** Click the project name to rename it in place — no trip to the Edit page, matching Jira's inline title edit. */
export function InlineEditableTitle({ project }: { project: Project }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(project.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function startEdit() {
    setValue(project.name);
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setError(null);
    setValue(project.name);
  }

  async function save() {
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Name is required");
      return;
    }
    if (trimmed === project.name) {
      setEditing(false);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload: ProjectInput = {
        name: trimmed,
        description: project.description,
        type: project.type,
        status: project.status,
        stage: project.stage,
        owner: project.owner,
        githubUrl: project.githubUrl,
        githubOwner: project.githubOwner,
        githubRepo: project.githubRepo,
        defaultBranch: project.defaultBranch,
        technologies: project.technologies,
        tags: project.tags,
        deploymentUrls: project.deploymentUrls,
      };
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Failed to save");
        setSaving(false);
        return;
      }
      setEditing(false);
      setSaving(false);
      router.refresh();
    } catch {
      setError("Network error — please try again");
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div>
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                save();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancel();
              }
            }}
            disabled={saving}
            className="-mx-1 rounded-md border border-orange-400 bg-white px-1 py-0.5 text-xl font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-orange-500/40 disabled:opacity-60 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <button
            type="button"
            onClick={save}
            disabled={saving}
            aria-label="Save name"
            title="Save"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-green-600 hover:bg-green-50 disabled:opacity-50 dark:text-green-400 dark:hover:bg-green-500/10"
          >
            <Check size={16} />
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={saving}
            aria-label="Cancel"
            title="Cancel"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800"
          >
            <X size={16} />
          </button>
        </div>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      title="Click to rename"
      className="group -mx-1 flex items-center gap-1.5 rounded-md px-1 py-0.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
    >
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{project.name}</h1>
      <Pencil size={14} className="shrink-0 text-zinc-300 opacity-0 group-hover:opacity-100 dark:text-zinc-600" />
    </button>
  );
}
