"use client";

import type { IconType } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

/** Filter control that matches Dropdown's `.field` chrome, with an on/off switch instead of a checkbox. */
export function ToggleFilter({
  label,
  checked,
  onChange,
  icon: Icon,
  className,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  icon?: IconType;
  className?: string;
}) {
  return (
    <div className={cn("field flex items-center justify-between gap-3", className)}>
        <span className="flex min-w-0 items-center gap-2 whitespace-nowrap">
        {Icon && <Icon size={14} className="shrink-0 text-zinc-400" />}
        <span className="truncate">{label}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          checked ? "bg-orange-600" : "bg-zinc-300 dark:bg-zinc-600",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
            checked && "translate-x-4",
          )}
        />
      </button>
    </div>
  );
}
