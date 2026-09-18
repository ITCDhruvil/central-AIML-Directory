"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Loader2, X } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { cn } from "@/lib/cn";
import { saveProjectFields } from "@/lib/saveProjectFields";
import {
  TECHNOLOGY_CATEGORY_ICONS,
  TECHNOLOGY_CATEGORY_LABELS,
  groupTechnologiesByCategory,
} from "@/lib/technologyGroups";
import type { Project } from "@/types/project";
import { TECHNOLOGY_CATEGORIES, type Technology, type TechnologyCategory } from "@/types/technology";

export function TechStackSummaryEditor({ project }: { project: Project }) {
  const router = useRouter();
  const [technologies, setTechnologies] = useState(project.technologies);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [category, setCategory] = useState<TechnologyCategory>("OTHER");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = editing ? technologies : project.technologies;
  const groups = groupTechnologiesByCategory(visible);

  async function persist(next: Technology[]) {
    setSaving(true);
    setError(null);
    const previous = technologies;
    setTechnologies(next);
    try {
      const updated = await saveProjectFields(project.id, { technologies: next });
      setTechnologies(updated.technologies);
      router.refresh();
    } catch (err) {
      setTechnologies(previous);
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function addFromDraft() {
    const name = draft.trim();
    if (!name || saving) return;
    if (technologies.some((tech) => tech.name.toLowerCase() === name.toLowerCase())) {
      setDraft("");
      return;
    }
    setDraft("");
    void persist([
      ...technologies,
      { name, category, evidence: ["manual"], confidence: "HIGH" },
    ]);
  }

  function remove(name: string) {
    if (saving) return;
    void persist(technologies.filter((tech) => tech.name !== name));
  }

  function startEdit() {
    setTechnologies(project.technologies);
    setEditing(true);
  }

  if (!editing) {
    if (groups.length === 0) {
      return (
        <button
          type="button"
          onClick={startEdit}
          className="w-full rounded-md px-1 py-2 text-left text-sm text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
        >
          Add technologies
        </button>
      );
    }

    return (
      <div
        role="button"
        tabIndex={0}
        onClick={startEdit}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            startEdit();
          }
        }}
        className="w-full cursor-text divide-y divide-zinc-100 rounded-md text-left hover:bg-zinc-50 dark:divide-zinc-800 dark:hover:bg-zinc-800/40"
        aria-label="Edit tech stack"
      >
        {groups.map(([group, items]) => {
          const Icon = TECHNOLOGY_CATEGORY_ICONS[group];
          return (
            <div key={group} className="flex items-start justify-between gap-3 px-1 py-2 text-sm">
              <span className="flex shrink-0 items-center gap-2 text-zinc-500 dark:text-zinc-400">
                <Icon size={14} />
                {TECHNOLOGY_CATEGORY_LABELS[group]}
              </span>
              <div className="flex flex-wrap justify-end gap-1">
                {items.map((tech) => (
                  <span
                    key={tech.name}
                    className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    {tech.name}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {groups.length > 0 ? (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {groups.map(([group, items]) => {
            const Icon = TECHNOLOGY_CATEGORY_ICONS[group];
            return (
              <div key={group} className="flex items-start justify-between gap-3 py-2 text-sm">
                <span className="flex shrink-0 items-center gap-2 pt-0.5 text-zinc-500 dark:text-zinc-400">
                  <Icon size={14} />
                  {TECHNOLOGY_CATEGORY_LABELS[group]}
                </span>
                <div className="flex flex-wrap justify-end gap-1">
                  {items.map((tech) => (
                    <span
                      key={tech.name}
                      className="inline-flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                      {tech.name}
                      <button
                        type="button"
                        aria-label={`Remove ${tech.name}`}
                        onClick={() => remove(tech.name)}
                        className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-zinc-400">No technologies yet.</p>
      )}

      <div className="flex items-center gap-1.5">
        <Dropdown
          value={category}
          onChange={(value) => setCategory(value as TechnologyCategory)}
          options={TECHNOLOGY_CATEGORIES.map((item) => ({
            value: item,
            label: TECHNOLOGY_CATEGORY_LABELS[item],
          }))}
          aria-label="Technology category"
          className="w-32 shrink-0"
          triggerClassName="field flex w-full items-center justify-between gap-1 px-2 py-1.5 pr-1.5 text-left text-xs"
        />
        <div className="relative min-w-0 flex-1">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addFromDraft();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setEditing(false);
                setDraft("");
              }
            }}
            placeholder="Add a technology"
            disabled={saving}
            className="field w-full py-1.5 pr-8"
            aria-label="Technology name"
          />
          <button
            type="button"
            aria-label="Add technology"
            title="Press Enter to add"
            disabled={saving || !draft.trim()}
            onClick={addFromDraft}
            className="absolute inset-y-0 right-0 flex items-center px-2 text-zinc-400 hover:text-orange-600 disabled:opacity-40 dark:hover:text-orange-400"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CornerDownLeft size={14} />}
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          setEditing(false);
          setDraft("");
        }}
        className={cn("text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200")}
      >
        Done
      </button>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
