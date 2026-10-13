"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { LogOut, Moon, Settings } from "lucide-react";
import { Switch } from "@/components/ui/Switch";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/Avatar";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/auth/permissionLabels";
import type { AuthUser } from "@/lib/auth/types";
import {
  applyTheme,
  getStoredTheme,
  subscribeTheme,
  type ThemePreference,
} from "@/lib/theme";
import { useClickOutside } from "@/lib/useClickOutside";

function prefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

// Shared look for every row in the card. The hover fill is deliberately strong enough to see on white.
const ROW =
  "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500";

/**
 * The collapsed sidebar's profile button. Hover (or click) opens a card beside the sidebar with the person's
 * details, a Settings button, a dark-theme switch and Sign out — everything that used to sit loose at the bottom.
 */
export function ProfileMenu({
  user,
  onNavigate,
  onSignOut,
}: {
  user: AuthUser;
  onNavigate?: () => void;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);
  const theme = useSyncExternalStore(
    subscribeTheme,
    getStoredTheme,
    () => "light" as ThemePreference,
  );
  const isDark = theme === "dark" || (theme === "system" && prefersDark());

  useClickOutside(ref, () => setOpen(false), open);
  useEffect(
    () => () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    },
    [],
  );

  function enter() {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setOpen(true);
  }

  function leave() {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 180);
  }

  return (
    <div ref={ref} onMouseEnter={enter} onMouseLeave={leave}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Profile: ${user.name}`}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        className="flex h-10 w-10 items-center justify-center rounded-full shadow-sm ring-2 ring-white transition-shadow hover:ring-orange-300 focus-visible:outline-none focus-visible:ring-orange-400 dark:ring-zinc-700 dark:hover:ring-orange-500/70"
      >
        <Avatar user={user} size={40} />
      </button>

      {open && (
        // Positioned against the sidebar (not the avatar): it starts just past the sidebar's right edge and its
        // bottom lines up with the sidebar's bottom. The small left padding is the gap, and it keeps hover alive across it.
        <div
          role="menu"
          className="absolute bottom-0 left-full z-50 w-80 max-w-[calc(100vw-6rem)] pl-1.5"
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        >
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <div className="flex items-center gap-3.5 px-5 pb-3 pt-5">
              <Avatar
                user={user}
                size={56}
                className="ring-1 ring-orange-100 dark:ring-orange-500/20"
              />
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-50">
                  {user.name}
                </p>
                <p className="truncate text-[13px] font-medium text-zinc-600 dark:text-zinc-400">
                  {user.email}
                </p>
              </div>
            </div>

            <div className="mx-5 mb-4 rounded-md bg-zinc-50 px-3.5 py-3 ring-1 ring-zinc-100 dark:bg-zinc-800/60 dark:ring-zinc-800">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Role
                </p>
                <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-800 dark:bg-orange-500/20 dark:text-orange-200">
                  {ROLE_LABELS[user.role]}
                </span>
              </div>
              <p className="mt-1.5 text-[13px] font-medium leading-relaxed text-zinc-600 dark:text-zinc-400">
                {ROLE_DESCRIPTIONS[user.role]}
              </p>
            </div>

            <div className="border-t border-zinc-100 p-1.5 dark:border-zinc-800">
              <Link
                href="/settings"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onNavigate?.();
                }}
                className={cn(
                  ROW,
                  "text-zinc-900 hover:bg-zinc-100 hover:text-orange-700 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-orange-300",
                )}
              >
                <Settings size={18} strokeWidth={1.75} className="shrink-0" />
                Settings
              </Link>

              {/* The whole row toggles the theme; the switch is just its visual state. */}
              <div
                role="menuitemcheckbox"
                aria-checked={isDark}
                tabIndex={0}
                onClick={() => applyTheme(isDark ? "light" : "dark")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    applyTheme(isDark ? "light" : "dark");
                  }
                }}
                className={cn(
                  ROW,
                  "cursor-pointer text-zinc-900 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800",
                )}
              >
                <Moon size={18} strokeWidth={1.75} className="shrink-0" />
                <span className="flex-1">Dark theme</span>
                <span onClick={(e) => e.stopPropagation()}>
                  <Switch
                    checked={isDark}
                    onChange={(next) => applyTheme(next ? "dark" : "light")}
                    label="Dark theme"
                  />
                </span>
              </div>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onSignOut();
                }}
                className={cn(
                  ROW,
                  "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10",
                )}
              >
                <LogOut size={18} strokeWidth={1.75} className="shrink-0" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
