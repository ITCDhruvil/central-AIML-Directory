"use client";

import type { IconType } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
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
    <div className={cn("field flex h-10 items-center justify-between gap-3 py-0", className)}>
        <span className="flex min-w-0 items-center gap-2 whitespace-nowrap">
        {Icon && <Icon size={14} className="shrink-0 text-zinc-400" />}
        <span className="truncate">{label}</span>
      </span>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}
