"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MarkdownView } from "@/components/MarkdownView";
import { Button } from "@/components/ui/Button";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { saveProjectFields } from "@/lib/saveProjectFields";
import type { Project } from "@/types/project";

export function InlineEditableDescription({ project }: { project: Project }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(project.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit() {
    setValue(project.description ?? "");
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setError(null);
    setValue(project.description ?? "");
  }

  async function save() {
    const next = value.trim() ? value : null;
    if ((next ?? "") === (project.description ?? "")) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveProjectFields(project.id, { description: next });
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div>
        <RichTextEditor
          value={value}
          onChange={setValue}
          placeholder="Describe the project"
          className="min-h-[16rem]"
        />
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        <div className="mt-3 flex gap-2">
          <Button type="button" variant="primary" loading={saving} onClick={() => void save()}>
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button type="button" variant="secondary" disabled={saving} onClick={cancel}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (!project.description?.trim()) {
    return (
      <button
        type="button"
        onClick={startEdit}
        className="w-full rounded-md px-1 py-6 text-left text-sm text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
      >
        Add a description
      </button>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a")) return;
        startEdit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          startEdit();
        }
      }}
      className="w-full cursor-text rounded-md px-1 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
      aria-label="Edit description"
    >
      <MarkdownView content={project.description} />
    </div>
  );
}
