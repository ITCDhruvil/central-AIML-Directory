"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, CornerDownLeft, Loader2, Plus, Trash2, User } from "lucide-react";
import { cn } from "@/lib/cn";
import { useClickOutside } from "@/lib/useClickOutside";
import type { Owner } from "@/types/owner";

/**
 * Owner picker used by project/idea forms: a Dropdown-styled listbox with a
 * shared catalog of names, an "Add custom name" action, and hover-to-delete.
 */
export function OwnerSelect({
  value,
  onChange,
  className,
  triggerClassName,
  defaultOpen = false,
  onDismiss,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  triggerClassName?: string;
  defaultOpen?: boolean;
  onDismiss?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [highlighted, setHighlighted] = useState(0);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const draftRef = useRef<HTMLInputElement>(null);

  useClickOutside(
    ref,
    () => {
      setOpen(false);
      setAdding(false);
      setDraft("");
      setError(null);
      onDismiss?.();
    },
    open,
  );

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/owners", { signal: controller.signal })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : "Failed to load owners");
        setOwners(Array.isArray(body.owners) ? body.owners : []);
      })
      .catch((err) => {
        if (!(err instanceof Error) || err.name !== "AbortError") {
          setError("Couldn't load owners");
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (adding) draftRef.current?.focus();
  }, [adding]);

  const catalogNames = new Set(owners.map((o) => o.name));
  const options: { id: string | null; name: string }[] = [
    { id: null, name: "" },
    ...owners.map((o) => ({ id: o.id, name: o.name })),
  ];
  if (value && !catalogNames.has(value)) {
    options.splice(1, 0, { id: null, name: value });
  }

  const selectedLabel = value || "No owner";

  function openMenu() {
    setHighlighted(Math.max(0, options.findIndex((o) => o.name === value)));
    setOpen(true);
    setError(null);
  }

  function choose(name: string) {
    onChange(name);
    setOpen(false);
    setAdding(false);
    setDraft("");
  }

  async function handleCreate() {
    const name = draft.trim();
    if (!name || saving) return;

    const existing = owners.find((o) => o.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      onChange(existing.name);
      setAdding(false);
      setDraft("");
      setOpen(false);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/owners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : "Couldn't save name");
        return;
      }
      const owner = body.owner as Owner;
      setOwners((prev) => [...prev, owner].sort((a, b) => a.name.localeCompare(b.name)));
      onChange(owner.name);
      setAdding(false);
      setDraft("");
      setOpen(false);
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(owner: Owner, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setError(null);
    try {
      const res = await fetch(`/api/owners/${owner.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => ({}));
        setError(typeof body.error === "string" ? body.error : "Couldn't delete name");
        return;
      }
      setOwners((prev) => prev.filter((o) => o.id !== owner.id));
      if (value === owner.name) onChange("");
    } catch {
      setError("Network error — please try again");
    }
  }

  function handleTriggerKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openMenu();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      openMenu();
    }
  }

  function handleListKeyDown(e: React.KeyboardEvent) {
    if (adding) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const option = options[highlighted];
      if (option) choose(option.name);
    } else if (e.key === "Tab") {
      setOpen(false);
      onDismiss?.();
    }
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => {
          if (open) {
            setOpen(false);
            onDismiss?.();
          } else {
            openMenu();
          }
        }}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Owner"
        className={cn(
          triggerClassName ?? "field flex w-full items-center justify-between gap-2 pr-2 text-left",
        )}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          <User size={14} className="shrink-0 text-zinc-400" />
          <span className={cn("truncate", !value && "text-zinc-400")}>{selectedLabel}</span>
        </span>
        <ChevronDown size={14} className={cn("shrink-0 text-zinc-400 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-zinc-200 bg-white text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <ul
            role="listbox"
            tabIndex={-1}
            onKeyDown={handleListKeyDown}
            ref={(el) => {
              if (el && !adding) el.focus();
            }}
            className="max-h-56 overflow-auto py-1 focus:outline-none"
          >
            {loading ? (
              <li className="px-3 py-2 text-zinc-400">Loading...</li>
            ) : (
              options.map((option, i) => {
                const isSelected = option.name === value;
                const owner = option.id ? owners.find((o) => o.id === option.id) : undefined;
                return (
                  <li
                    key={option.id ?? `orphan-${option.name || "none"}`}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setHighlighted(i)}
                    onClick={() => choose(option.name)}
                    className={cn(
                      "group flex cursor-pointer items-center gap-2 px-3 py-1.5",
                      isSelected
                        ? "bg-orange-50 font-medium text-orange-600 dark:bg-orange-500/10 dark:text-orange-400"
                        : "text-zinc-700 dark:text-zinc-200",
                      i === highlighted && !isSelected && "bg-zinc-100 dark:bg-zinc-800",
                    )}
                  >
                    <span className={cn("min-w-0 flex-1 truncate", !option.name && "text-zinc-400")}>
                      {option.name || "No owner"}
                    </span>
                    {isSelected && <Check size={14} className="shrink-0" />}
                    {owner && (
                      <button
                        type="button"
                        aria-label={`Delete ${owner.name}`}
                        title="Remove from list"
                        onClick={(e) => handleDelete(owner, e)}
                        className="rounded p-0.5 text-zinc-400 opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600 focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 dark:hover:bg-red-950 dark:hover:text-red-400"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </li>
                );
              })
            )}
          </ul>

          <div className="border-t border-zinc-100 dark:border-zinc-800">
            {adding ? (
              <div className="p-1.5">
                <div className="relative">
                  <input
                    ref={draftRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        e.stopPropagation();
                        setAdding(false);
                        setDraft("");
                      }
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.stopPropagation();
                        void handleCreate();
                      }
                    }}
                    maxLength={100}
                    placeholder="Type a name"
                    className="field w-full py-1.5 pr-8"
                    aria-label="Custom owner name"
                  />
                  <button
                    type="button"
                    aria-label="Add name"
                    title="Press Enter to add"
                    disabled={saving || !draft.trim()}
                    onClick={() => void handleCreate()}
                    className="absolute inset-y-0 right-0 flex items-center px-2 text-zinc-400 hover:text-orange-600 disabled:opacity-40 dark:hover:text-orange-400"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <CornerDownLeft size={14} />}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAdding(true);
                  setError(null);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-500/10"
              >
                <Plus size={14} />
                Add custom name
              </button>
            )}
          </div>

          {error && <p className="border-t border-zinc-100 px-3 py-1.5 text-xs text-red-600 dark:border-zinc-800">{error}</p>}
        </div>
      )}
    </div>
  );
}
