"use client";

import { useState, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import type { Technology } from "@/types/technology";
import { Button } from "@/components/ui/Button";

export function TechnologyEditor({
  value,
  onChange,
  endAdornment,
}: {
  value: Technology[];
  onChange: (next: Technology[]) => void;
  /** Optional control rendered beside the Add button (e.g. per-field AI). */
  endAdornment?: ReactNode;
}) {
  const [draft, setDraft] = useState("");

  function addFromDraft() {
    const name = draft.trim();
    if (!name) return;
    if (value.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...value, { name, category: "OTHER", evidence: ["manual"], confidence: "HIGH" }]);
    setDraft("");
  }

  function remove(name: string) {
    onChange(value.filter((t) => t.name !== name));
  }

  return (
    <div>
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((t) => (
            <span
              key={t.name}
              title={t.evidence.length > 0 ? `Evidence: ${t.evidence.join(", ")}` : undefined}
              className="inline-flex items-center gap-1 rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {t.name}
              <button
                type="button"
                onClick={() => remove(t.name)}
                aria-label={`Remove ${t.name}`}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addFromDraft();
              }
            }}
            placeholder="Add a technology and press Enter"
            className={endAdornment ? "field w-full pr-16" : "field w-full"}
          />
          {endAdornment}
        </div>
        <Button type="button" variant="secondary" icon={Plus} onClick={addFromDraft}>
          Add
        </Button>
      </div>
    </div>
  );
}
