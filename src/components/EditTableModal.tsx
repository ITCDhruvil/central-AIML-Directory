"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Lock, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";
import { COLUMN_META, availableColumns, columnDataCount, type ColumnId } from "@/lib/projectTable";
import type { Project } from "@/types/project";

/**
 * Admin dialog for the projects table: remove columns from the table, reorder them, or add one of the
 * columns that exist for projects but aren't shown yet. Each available column shows how many of the
 * current projects have data for it, so nobody adds an empty column by accident.
 */
export function EditTableModal({
  open,
  onClose,
  columns,
  projects,
  scope,
  hasPersonalLayout,
  onSaved,
  onResetPersonal,
}: {
  open: boolean;
  onClose: () => void;
  columns: ColumnId[];
  projects: Project[];
  /** "everyone" saves the default for all users (admins); "personal" keeps the layout in this browser only. */
  scope: "everyone" | "personal";
  hasPersonalLayout: boolean;
  onSaved: (columns: ColumnId[]) => void;
  onResetPersonal: () => void;
}) {
  const [draft, setDraft] = useState<ColumnId[]>(columns);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const available = availableColumns(draft);
  const dirty = draft.join(",") !== columns.join(",");

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    // "Project" stays first, so nothing swaps into position 0.
    if (target < 1 || target >= draft.length) return;
    const next = [...draft];
    [next[index], next[target]] = [next[target], next[index]];
    setDraft(next);
  }

  function close() {
    if (saving) return;
    setDraft(columns);
    setError(null);
    onClose();
  }

  async function save() {
    if (scope === "personal") {
      onSaved(draft);
      onClose();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/table-columns", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columns: draft }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; columns?: ColumnId[] };
      if (!res.ok || !body.columns) {
        setError(body.error ?? "Failed to save the table");
        return;
      }
      onSaved(body.columns);
      onClose();
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Edit table"
      description={
        scope === "everyone"
          ? "Choose which columns the projects table shows for everyone."
          : "Choose which columns you see. This only changes your own view."
      }
      className="max-w-3xl"
      footer={
        <>
          {error && (
            <p role="alert" className="mr-auto text-sm text-red-600">
              {error}
            </p>
          )}
          {scope === "personal" && hasPersonalLayout && (
            <Button
              variant="ghost"
              onClick={() => {
                onResetPersonal();
                onClose();
              }}
              className="mr-auto"
            >
              Use the default layout
            </Button>
          )}
          <Button variant="secondary" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} disabled={!dirty} onClick={save}>
            {scope === "everyone" ? "Save for everyone" : "Save my view"}
          </Button>
        </>
      }
    >
      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">In the table ({draft.length})</h3>
          <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {draft.map((column, index) => (
              <li key={column} className="flex items-center gap-2 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{COLUMN_META[column].label}</p>
                  <p className="truncate text-xs text-zinc-400">{COLUMN_META[column].description}</p>
                </div>
                {column === "name" ? (
                  <span title="Always shown" className="flex h-7 items-center gap-1 text-[11px] text-zinc-400">
                    <Lock size={12} />
                    Required
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      aria-label={`Move ${COLUMN_META[column].label} up`}
                      disabled={index <= 1}
                      onClick={() => move(index, -1)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30 dark:hover:bg-zinc-800"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${COLUMN_META[column].label} down`}
                      disabled={index === draft.length - 1}
                      onClick={() => move(index, 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30 dark:hover:bg-zinc-800"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${COLUMN_META[column].label}`}
                      onClick={() => setDraft(draft.filter((c) => c !== column))}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                    >
                      <X size={15} />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Available to add ({available.length})</h3>
          {available.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-400 dark:border-zinc-700">
              Every column is already in the table.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {available.map((column) => {
                const count = columnDataCount(projects, column);
                return (
                  <li key={column} className="flex items-center gap-2 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{COLUMN_META[column].label}</p>
                      <p className={cn("truncate text-xs", count === 0 ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-400")}>
                        {count === 0
                          ? "No project has this yet"
                          : `${count} of ${projects.length} ${projects.length === 1 ? "project has" : "projects have"} this`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDraft([...draft, column])}
                      className="flex h-7 items-center gap-1 rounded-md border border-zinc-200 px-2 text-xs font-medium text-zinc-600 transition-colors hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-orange-500/10"
                    >
                      <Plus size={13} />
                      Add
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </Modal>
  );
}
