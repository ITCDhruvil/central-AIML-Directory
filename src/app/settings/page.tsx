"use client";

import { useSyncExternalStore } from "react";
import { Check, Laptop, Moon, Sun } from "lucide-react";
import { applyTheme, getStoredTheme, subscribeTheme, type ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/cn";

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Laptop },
];

export default function SettingsPage() {
  const theme = useSyncExternalStore(subscribeTheme, getStoredTheme, () => "light" as ThemePreference);

  function choose(value: ThemePreference) {
    applyTheme(value);
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Preferences for this browser.</p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Appearance</h2>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Choose how the dashboard looks on this device.</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {THEME_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = theme === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => choose(opt.value)}
                aria-pressed={active}
                className={cn(
                  "relative flex flex-col items-center gap-1.5 rounded-md border p-3 text-sm font-medium transition-colors",
                  active
                    ? "border-orange-600 bg-orange-50 text-orange-700 dark:border-orange-400 dark:bg-orange-500/10 dark:text-orange-400"
                    : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800",
                )}
              >
                {active && <Check size={12} className="absolute right-1.5 top-1.5" />}
                <Icon size={18} />
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
