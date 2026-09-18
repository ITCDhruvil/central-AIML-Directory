"use client";

import { useRef, useState } from "react";
import { Check, ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { useClickOutside } from "@/lib/useClickOutside";

export interface DropdownOption {
  value: string;
  label: string;
  /** Per-option leading icon — e.g. a status dot or category glyph. */
  icon?: LucideIcon;
  /** Tailwind text-color class applied to that option's icon (e.g. "text-green-600"). */
  iconClassName?: string;
}

/**
 * The app's one reusable select control — a real custom listbox, not a
 * styled native <select>. Native selects hand their popup to the OS, which
 * can't be restyled cross-browser (the exact thing this replaces). Built
 * once, used everywhere a value needs picking from a short list.
 */
export function Dropdown({
  value,
  onChange,
  options,
  icon: Icon,
  placeholder,
  className,
  triggerClassName,
  defaultOpen = false,
  onDismiss,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  icon?: LucideIcon;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  defaultOpen?: boolean;
  onDismiss?: () => void;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [highlighted, setHighlighted] = useState(() =>
    Math.max(0, options.findIndex((o) => o.value === value)),
  );
  const ref = useRef<HTMLDivElement>(null);

  useClickOutside(
    ref,
    () => {
      setOpen(false);
      onDismiss?.();
    },
    open,
  );

  const selected = options.find((o) => o.value === value);

  function openAt(index: number) {
    setHighlighted(Math.max(0, Math.min(index, options.length - 1)));
    setOpen(true);
  }

  function choose(index: number) {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false);
  }

  function handleTriggerKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openAt(Math.max(0, options.findIndex((o) => o.value === value)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      openAt(options.length - 1);
    }
  }

  function handleListKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(highlighted);
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
            openAt(Math.max(0, options.findIndex((o) => o.value === value)));
          }
        }}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={cn(
          triggerClassName ?? "field flex w-full items-center justify-between gap-2 pr-2 text-left",
        )}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          {selected?.icon ? (
            <selected.icon size={14} className={cn("shrink-0", selected.iconClassName ?? "text-zinc-400")} />
          ) : (
            Icon && <Icon size={14} className="shrink-0 text-zinc-400" />
          )}
          <span className={cn("truncate", !selected && "text-zinc-400")}>{selected?.label ?? placeholder}</span>
        </span>
        <ChevronDown size={14} className={cn("shrink-0 text-zinc-400 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <ul
          role="listbox"
          tabIndex={-1}
          onKeyDown={handleListKeyDown}
          ref={(el) => el?.focus()}
          className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border border-zinc-200 bg-white py-1 text-sm shadow-lg focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
        >
          {options.map((option, i) => {
            const isSelected = option.value === value;
            const OptionIcon = option.icon;
            return (
              <li
                key={option.value}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setHighlighted(i)}
                onClick={() => choose(i)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 px-3 py-1.5",
                  isSelected
                    ? "font-medium text-orange-600 dark:text-orange-400"
                    : "text-zinc-700 dark:text-zinc-200",
                  i === highlighted && !isSelected && "bg-zinc-100 dark:bg-zinc-800",
                  isSelected && "bg-orange-50 dark:bg-orange-500/10",
                )}
              >
                {OptionIcon && (
                  <OptionIcon size={14} className={cn("shrink-0", !isSelected && (option.iconClassName ?? "text-zinc-400"))} />
                )}
                <span className="flex-1 truncate">{option.label}</span>
                {isSelected && <Check size={14} className="shrink-0" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
