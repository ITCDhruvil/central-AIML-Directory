"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/core";
import { Baseline, Highlighter, type LucideIcon } from "lucide-react";
import { ColorPicker } from "@/components/ui/color-picker";
import { Button } from "@/components/ui/shadcn/button";
import { cn } from "@/lib/cn";

// A few handy starting colours; the picker itself can make any colour.
const SWATCHES = ["#EF4444", "#F97316", "#EAB308", "#22C55E", "#14B8A6", "#3B82F6", "#8B5CF6", "#EC4899", "#71717A"] as const;

function ColorButton({ editor, mark, label, icon: Icon, fallback }: { editor: Editor; mark: "textColor" | "highlight"; label: string; icon: LucideIcon; fallback: string }) {
  const [open, setOpen] = useState(false);
  const current = (editor.getAttributes(mark).color as string | undefined) ?? undefined;

  return (
    <ColorPicker
      open={open}
      onOpenChange={setOpen}
      value={(current ?? fallback) as `#${string}`}
      swatches={[...SWATCHES]}
      align="start"
      footer={({ value, close }) => (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">The colour adapts: lighter in dark mode, deeper in light mode.</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={() => {
                editor.chain().focus().setMark(mark, { color: value.hex.toLowerCase() }).run();
                close();
              }}
            >
              Apply
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                editor.chain().focus().unsetMark(mark).run();
                close();
              }}
            >
              Remove
            </Button>
          </div>
        </div>
      )}
    >
      <button
        type="button"
        title={label}
        aria-label={label}
        aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()}
        className={cn(
          "relative flex h-7 w-7 items-center justify-center rounded transition-colors",
          open || current ? "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400" : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800",
        )}
      >
        <Icon size={14} />
        <span className="absolute inset-x-1.5 bottom-0.5 h-[3px] rounded-full" style={{ background: current ?? "transparent" }} />
      </button>
    </ColorPicker>
  );
}

/** Text colour and highlight: each opens the colour picker and applies the colour to the selected text. */
export function ColorTools({ editor }: { editor: Editor }) {
  return (
    <>
      <ColorButton editor={editor} mark="textColor" label="Text color" icon={Baseline} fallback="#3b82f6" />
      <ColorButton editor={editor} mark="highlight" label="Highlight" icon={Highlighter} fallback="#eab308" />
    </>
  );
}
