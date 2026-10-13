"use client";

import { useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { useCan } from "@/components/AuthProvider";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { buildCellPatch } from "@/lib/projectCellEdit";
import { COLUMN_META, type ColumnId } from "@/lib/projectTable";
import { useClickOutside } from "@/lib/useClickOutside";
import { PROJECT_STAGES } from "@/types/project";

const PLACEHOLDERS: Partial<Record<ColumnId, string>> = {
  github: "https://github.com/owner/repo",
  deployment: "https://app.example.com",
  branch: "main",
};

const STAGE_LABEL = (stage: string) => stage.charAt(0) + stage.slice(1).toLowerCase();

/** Chips input for list columns: Enter or comma adds the typed value. */
function ListInput({ values, onChange, placeholder }: { values: string[]; onChange: (next: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");

  function commit() {
    const parts = draft.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length) onChange([...values, ...parts.filter((p) => !values.some((v) => v.toLowerCase() === p.toLowerCase()))]);
    setDraft("");
  }

  return (
    <div className="space-y-2">
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">
              {v}
              <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}>
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        autoFocus
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && draft === "" && values.length > 0) {
            onChange(values.slice(0, -1));
          }
        }}
        onBlur={commit}
        className="field h-9 w-full"
      />
    </div>
  );
}

/**
 * Shown in place of a dash when a project or idea has no value for a column. Click it to fill in that one field for
 * that one row, in a small popover, without opening the item. People who can't edit it just see a dash.
 *
 * The component only collects the value; `onSave` receives the partial update and does the saving (and throws an
 * Error with a readable message if it fails), so the same popover serves both tables.
 */
export function EmptyCellAdd({
  name,
  resource,
  column,
  ownerSuggestions,
  onSave,
}: {
  /** What the popover says it is adding to. */
  name: string;
  /** Which permission decides whether the "+ Add" is offered. */
  resource: "projects" | "ideas";
  column: ColumnId;
  ownerSuggestions: string[];
  onSave: (patch: Record<string, unknown>) => Promise<void>;
}) {
  const canEdit = useCan(resource, "edit");
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const [text, setText] = useState("");
  const [list, setList] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useClickOutside(ref, () => close(), open);

  if (!canEdit) return <span className="text-zinc-300 dark:text-zinc-600">—</span>;

  const isList = column === "technologies" || column === "tags";
  const label = COLUMN_META[column].label.toLowerCase();

  function close() {
    setOpen(false);
    setError(null);
    setText("");
    setList([]);
  }

  function openEditor() {
    // Open toward the side with room so the popover never runs off the screen.
    const rect = ref.current?.getBoundingClientRect();
    setAlignRight(Boolean(rect && rect.left + 288 > window.innerWidth - 8));
    setOpen(true);
    if (column === "owner") {
      // The saved owner list, so the drop list offers everyone who can be an owner, not only owners already on a project.
      fetch("/api/owners")
        .then((r) => r.json())
        .then((body: { owners?: { name: string }[] }) => setCatalog((body.owners ?? []).map((o) => o.name)))
        .catch(() => undefined);
    }
  }

  async function save(value: string | string[] = isList ? list : text) {
    const built = buildCellPatch(column, value);
    if (!built.ok) {
      setError(built.error);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(built.patch);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  // Everyone who can be an owner: the saved owner list plus anyone already named on a project.
  const ownerChoices = [...new Map([...catalog, ...ownerSuggestions].map((n) => [n.toLowerCase(), n])).values()].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
  const query = text.trim().toLowerCase();
  const filteredOwners = ownerChoices.filter((n) => n.toLowerCase().includes(query));
  const canCreateOwner = query !== "" && !ownerChoices.some((n) => n.toLowerCase() === query);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => (open ? close() : openEditor())}
        aria-expanded={open}
        title={`Add ${label}`}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-zinc-400 transition-colors hover:bg-orange-50 hover:text-orange-600 dark:text-zinc-500 dark:hover:bg-orange-500/10 dark:hover:text-orange-400"
      >
        <Plus size={13} />
        Add
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={`Add ${label}`}
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
          }}
          className={cn(
            "absolute top-full z-30 mt-1 w-72 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900",
            alignRight ? "right-0" : "left-0",
          )}
        >
          <p className="mb-2 truncate text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Add {label} · <span className="text-zinc-700 dark:text-zinc-200">{name}</span>
          </p>

          {column === "stage" ? (
            <div className="flex flex-wrap gap-1.5">
              {PROJECT_STAGES.map((stage) => (
                <button
                  key={stage}
                  type="button"
                  disabled={saving}
                  onClick={() => void save(stage)}
                  className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-orange-500/10"
                >
                  {STAGE_LABEL(stage)}
                </button>
              ))}
            </div>
          ) : column === "owner" ? (
            <div>
              <input
                autoFocus
                value={text}
                placeholder="Search owners…"
                onChange={(e) => setText(e.target.value)}
                className="field h-9 w-full"
              />
              <ul role="listbox" aria-label="Owners" className="mt-2 max-h-48 overflow-y-auto rounded-md border border-zinc-200 py-1 dark:border-zinc-700">
                {filteredOwners.map((name) => (
                  <li key={name} role="option" aria-selected={false}>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void save(name)}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-700 transition-colors hover:bg-orange-50 hover:text-orange-700 disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-orange-500/10"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-50 text-[10px] font-semibold text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
                        {name.charAt(0).toUpperCase()}
                      </span>
                      <span className="truncate">{name}</span>
                    </button>
                  </li>
                ))}
                {filteredOwners.length === 0 && !canCreateOwner && (
                  <li className="px-3 py-2 text-xs text-zinc-400">No owners yet. Type a name to add one.</li>
                )}
                {canCreateOwner && (
                  <li>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void save(text)}
                      className="flex w-full items-center gap-2 border-t border-zinc-100 px-3 py-1.5 text-left text-sm font-medium text-orange-600 hover:bg-orange-50 disabled:opacity-50 dark:border-zinc-800 dark:hover:bg-orange-500/10"
                    >
                      <Plus size={14} className="shrink-0" />
                      <span className="truncate">Add &ldquo;{text.trim()}&rdquo; as a new owner</span>
                    </button>
                  </li>
                )}
              </ul>
            </div>
          ) : isList ? (
            <ListInput
              values={list}
              onChange={setList}
              placeholder={column === "technologies" ? "e.g. React, Python — press Enter" : "e.g. internal, demo — press Enter"}
            />
          ) : (
            <>
              <input
                autoFocus
                value={text}
                placeholder={PLACEHOLDERS[column]}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void save();
                  }
                }}
                className="field h-9 w-full"
              />
            </>
          )}

          {error && (
            <p role="alert" className="mt-2 text-xs text-red-600">
              {error}
            </p>
          )}

          {column !== "stage" && column !== "owner" && (
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={close} disabled={saving}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" loading={saving} onClick={() => void save()}>
                Save
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
