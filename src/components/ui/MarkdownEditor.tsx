"use client";

import { useState } from "react";
import { MarkdownView } from "@/components/MarkdownView";
import { cn } from "@/lib/cn";

/** A small Write/Preview textarea — the one markdown input used anywhere the app collects free-text content. */
export function MarkdownEditor({
  value,
  onChange,
  rows = 4,
  placeholder,
  mono,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  mono?: boolean;
  className?: string;
}) {
  const [tab, setTab] = useState<"write" | "preview">("write");

  return (
    <div className={cn("overflow-hidden rounded-md border border-zinc-300 dark:border-zinc-700", className)}>
      <div className="flex gap-1 border-b border-zinc-200 bg-zinc-50 px-2 pt-1.5 dark:border-zinc-800 dark:bg-zinc-950">
        {(["write", "preview"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "rounded-t-md px-2.5 py-1 text-xs font-medium capitalize transition-colors",
              tab === t
                ? "border border-b-0 border-zinc-300 bg-white text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "write" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className={cn(
            "w-full resize-y border-0 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:bg-zinc-900 dark:text-zinc-100",
            mono && "font-mono",
          )}
        />
      ) : (
        <div className="bg-white px-3 py-2 dark:bg-zinc-900" style={{ minHeight: `${rows * 1.5}rem` }}>
          {value.trim() ? (
            <MarkdownView content={value} />
          ) : (
            <p className="text-sm text-zinc-400">Nothing to preview yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
