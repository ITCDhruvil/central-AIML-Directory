"use client";

import { useSyncExternalStore } from "react";
import { Check, Laptop, Moon, Sun } from "lucide-react";
import { SettingsCard } from "@/components/settings/SettingsCard";
import {
  applyTheme,
  getStoredTheme,
  subscribeTheme,
  type ThemePreference,
} from "@/lib/theme";
import { cn } from "@/lib/cn";

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  hint: string;
  icon: typeof Sun;
}[] = [
  { value: "light", label: "Light", hint: "Bright and clean", icon: Sun },
  { value: "dark", label: "Dark", hint: "Easy on the eyes", icon: Moon },
  { value: "system", label: "System", hint: "Match this device", icon: Laptop },
];

export function AppearanceSettings() {
  const theme = useSyncExternalStore(
    subscribeTheme,
    getStoredTheme,
    () => "light" as ThemePreference,
  );

  return (
    <SettingsCard
      title="Appearance"
      description="Choose how the dashboard looks. This is saved in this browser only."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {THEME_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const active = theme === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => applyTheme(opt.value)}
              aria-pressed={active}
              className={cn(
                "relative flex flex-col items-center gap-1.5 rounded-xl border p-4 text-sm font-medium transition-colors",
                active
                  ? "border-orange-600 bg-orange-50 text-orange-700 dark:border-orange-400 dark:bg-orange-500/10 dark:text-orange-400"
                  : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800",
              )}
            >
              {active && (
                <Check size={14} className="absolute right-2.5 top-2.5" />
              )}
              <Icon size={20} />
              {opt.label}
              <span className="text-xs font-normal opacity-70">{opt.hint}</span>
            </button>
          );
        })}
      </div>
    </SettingsCard>
  );
}
