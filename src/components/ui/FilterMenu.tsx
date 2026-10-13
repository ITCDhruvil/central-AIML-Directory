"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronRight, SlidersHorizontal, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { useClickOutside } from "@/lib/useClickOutside";

export type FilterOption = { value: string; label: string; icon?: LucideIcon; iconClassName?: string };

export type FilterSection =
  | {
      id: string;
      label: string;
      kind: "multi";
      options: FilterOption[];
      selected: string[];
      onChange: (next: string[]) => void;
      /** Shown when nothing is picked, e.g. "All types". */
      allLabel: string;
    }
  | {
      id: string;
      label: string;
      kind: "single";
      options: FilterOption[];
      selected: string;
      onChange: (next: string) => void;
      /** Shown in the row when the selected value has no option, e.g. a custom sort. */
      fallbackLabel?: string;
    };

// Sizes used to decide where the menus fit before they are drawn (menu w-64, submenu w-56, plus the gap).
const MENU_WIDTH = 256;
const SUBMENU_WIDTH = 232;
const ROW_HEIGHT = 36;
const EDGE = 8;

type Placement = { align: "left" | "right"; drop: "down" | "up" };
type Active = { id: string; side: "right" | "left"; shift: number };

function summary(section: FilterSection): string {
  if (section.kind === "single") {
    return section.options.find((o) => o.value === section.selected)?.label ?? section.fallbackLabel ?? "";
  }
  if (section.selected.length === 0) return "All";
  if (section.selected.length === 1) return section.options.find((o) => o.value === section.selected[0])?.label ?? "1 selected";
  return `${section.selected.length} selected`;
}

function submenuHeight(section: FilterSection): number {
  const rows = section.options.length + (section.kind === "multi" ? 2 : 0);
  return Math.min(rows * ROW_HEIGHT + 16, 288);
}

function OptionRow({
  option,
  checked,
  box,
  onClick,
}: {
  option: FilterOption;
  checked: boolean;
  /** Checkbox look for multi-select; a trailing tick for single-select. */
  box: boolean;
  onClick: () => void;
}) {
  const Icon = option.icon;
  return (
    <button
      type="button"
      role={box ? "menuitemcheckbox" : "menuitemradio"}
      aria-checked={checked}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800",
        checked ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-600 dark:text-zinc-300",
      )}
    >
      {box && (
        <span
          className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
            checked ? "border-orange-600 bg-orange-600 text-white" : "border-zinc-300 dark:border-zinc-600",
          )}
        >
          {checked && <Check size={11} strokeWidth={3} />}
        </span>
      )}
      {Icon && <Icon size={14} className={cn("shrink-0", option.iconClassName ?? "text-zinc-400")} />}
      <span className="min-w-0 flex-1 truncate">{option.label}</span>
      {!box && checked && <Check size={15} className="shrink-0 text-orange-600" />}
    </button>
  );
}

/**
 * One "Filter" button that replaces a row of dropdowns. Hover (or click / keyboard) opens the list of filters;
 * hovering a filter opens its options beside it — checkboxes for multi-select, a tick for single-select.
 * Menus pick the side with room, so they never run off the screen; on phones the options open inline instead.
 * When filters are active the button shows a count and an × that clears them all.
 */
export function FilterMenu({
  sections,
  activeCount,
  onClear,
}: {
  sections: FilterSection[];
  activeCount: number;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Active | null>(null);
  const [placement, setPlacement] = useState<Placement>({ align: "left", drop: "down" });
  const ref = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);

  useClickOutside(ref, () => setOpen(false), open);
  useEffect(() => () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
  }, []);

  // Keep the menu on screen if the page scrolls or the window is resized while it is open.
  useEffect(() => {
    if (!open) return;
    const replace = () => place();
    window.addEventListener("scroll", replace, true);
    window.addEventListener("resize", replace);
    return () => {
      window.removeEventListener("scroll", replace, true);
      window.removeEventListener("resize", replace);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sections.length, activeCount]);

  /** Decide, from where the button is on screen, which way the main menu opens. Runs in event handlers, not render. */
  function place() {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const menuHeight = sections.length * 40 + 16 + (activeCount > 0 ? 44 : 0);
    setPlacement({
      align: rect.left + MENU_WIDTH > window.innerWidth - EDGE ? "right" : "left",
      drop: rect.bottom + menuHeight > window.innerHeight - EDGE && rect.top > menuHeight ? "up" : "down",
    });
  }

  function openMenu() {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    place();
    setOpen(true);
  }

  function leave() {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    // A short delay keeps the menu open while the pointer crosses the gap to a submenu.
    closeTimer.current = window.setTimeout(() => {
      setOpen(false);
      setActive(null);
    }, 180);
  }

  /** Open a filter's options on whichever side has room, nudged up if they would hang off the bottom. */
  function activate(section: FilterSection, row: HTMLElement) {
    const trigger = ref.current?.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    let side: Active["side"] = "right";
    if (trigger) {
      const menuLeft = placement.align === "left" ? trigger.left : trigger.right - MENU_WIDTH;
      const roomRight = window.innerWidth - (menuLeft + MENU_WIDTH);
      if (roomRight < SUBMENU_WIDTH + EDGE && menuLeft >= SUBMENU_WIDTH + EDGE) side = "left";
    }
    const overflow = rowRect.top + submenuHeight(section) - (window.innerHeight - EDGE);
    const shift = overflow > 0 ? -Math.min(overflow, Math.max(0, rowRect.top - EDGE)) : 0;
    setActive({ id: section.id, side, shift });
  }

  return (
    <div ref={ref} className="relative" onMouseEnter={openMenu} onMouseLeave={leave}>
      <div
        className={cn(
          "field flex h-10 items-center gap-1 p-0 pl-3",
          activeCount > 0 ? "pr-1.5" : "pr-3",
          activeCount > 0 && "border-orange-300 text-orange-700 dark:border-orange-500/40 dark:text-orange-300",
        )}
      >
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => {
            if (!open) place();
            setOpen((v) => !v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          className="flex h-full items-center gap-2 rounded"
        >
          <SlidersHorizontal size={14} className="shrink-0" />
          <span>Filter</span>
          {activeCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-600 px-1.5 text-[11px] font-semibold text-white">
              {activeCount}
            </span>
          )}
        </button>
        {activeCount > 0 && (
          <button
            type="button"
            aria-label="Clear all filters"
            title="Clear all filters"
            onClick={() => {
              onClear();
              setActive(null);
            }}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-orange-600/70 transition-colors hover:bg-orange-100 hover:text-orange-700 dark:text-orange-300/70 dark:hover:bg-orange-500/20 dark:hover:text-orange-200"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && (
        <div
          role="menu"
          className={cn(
            "absolute z-30 w-64 max-w-[calc(100vw-1rem)]",
            placement.align === "left" ? "left-0" : "right-0",
            placement.drop === "down" ? "top-full pt-1" : "bottom-full pb-1",
          )}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        >
          <div className="rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            {sections.map((section) => {
              const isActive = active?.id === section.id;
              return (
                <div key={section.id} className="relative" onMouseEnter={(e) => activate(section, e.currentTarget)}>
                  <button
                    type="button"
                    role="menuitem"
                    aria-haspopup="menu"
                    aria-expanded={isActive}
                    onClick={(e) => {
                      if (isActive) setActive(null);
                      else activate(section, e.currentTarget.parentElement ?? e.currentTarget);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 px-3.5 py-2 text-left text-sm transition-colors",
                      isActive ? "bg-zinc-100 dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60",
                    )}
                  >
                    <span className="font-medium text-zinc-800 dark:text-zinc-100">{section.label}</span>
                    <span className="ml-auto max-w-[7rem] truncate text-xs text-zinc-400">{summary(section)}</span>
                    <ChevronRight size={14} className="shrink-0 text-zinc-400" />
                  </button>

                  {isActive && (
                    <div
                      role="menu"
                      aria-label={section.label}
                      // Beside the row on sm+ (left or right, whichever has room), inline under it on phones.
                      // The padding on the facing side bridges the gap so hover isn't lost.
                      className={cn(
                        "sm:absolute sm:top-0 sm:w-56",
                        active.side === "right" ? "sm:left-full sm:pl-1" : "sm:right-full sm:pr-1",
                      )}
                      style={{ top: active.shift || undefined }}
                    >
                      <div className="max-h-[min(18rem,calc(100vh-1rem))] overflow-y-auto rounded-md border border-zinc-200 bg-white py-1 shadow-lg max-sm:border-0 max-sm:bg-zinc-50 max-sm:shadow-none dark:border-zinc-700 dark:bg-zinc-900 max-sm:dark:bg-zinc-800/50">
                        {section.kind === "multi" ? (
                          <>
                            <OptionRow
                              option={{ value: "", label: section.allLabel }}
                              checked={section.selected.length === 0}
                              box
                              onClick={() => section.onChange([])}
                            />
                            <div className="my-1 h-px bg-zinc-100 dark:bg-zinc-800" />
                            {section.options.map((option) => {
                              const checked = section.selected.includes(option.value);
                              return (
                                <OptionRow
                                  key={option.value}
                                  option={option}
                                  checked={checked}
                                  box
                                  onClick={() =>
                                    section.onChange(
                                      checked ? section.selected.filter((v) => v !== option.value) : [...section.selected, option.value],
                                    )
                                  }
                                />
                              );
                            })}
                          </>
                        ) : (
                          section.options.map((option) => (
                            <OptionRow
                              key={option.value}
                              option={option}
                              checked={section.selected === option.value}
                              box={false}
                              onClick={() => {
                                section.onChange(option.value);
                                setOpen(false);
                                setActive(null);
                              }}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
