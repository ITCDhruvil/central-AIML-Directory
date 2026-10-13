"use client";

import { cn } from "@/lib/cn";

/**
 * The app's one on/off toggle. Every switch uses this so they all look and behave the same
 * (styles live in globals.css under `.switch`). It is a real checkbox underneath, so it works with the
 * keyboard (Space), screen readers, and form libraries.
 */
export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
  size = "sm",
  className,
  id,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Accessible name. Required because the switch itself has no visible text. */
  label: string;
  disabled?: boolean;
  /** sm = 35×20px (dense rows), md = 42×24px. */
  size?: "sm" | "md";
  className?: string;
  id?: string;
}) {
  return (
    <label className={cn("switch", size === "md" && "switch-md", className)}>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="slider" />
    </label>
  );
}
