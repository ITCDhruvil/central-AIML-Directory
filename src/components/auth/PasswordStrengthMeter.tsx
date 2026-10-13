"use client";

import { Check, X } from "lucide-react";
import { passwordStrength } from "@/lib/auth/passwordStrength";
import { useSecurityPolicy } from "@/components/PolicyProvider";
import { cn } from "@/lib/cn";

const BAR = [
  "bg-zinc-200 dark:bg-zinc-700",
  "bg-red-500",
  "bg-amber-500",
  "bg-lime-500",
  "bg-emerald-500",
];
const TEXT = [
  "text-zinc-400",
  "text-red-500",
  "text-amber-600",
  "text-lime-600",
  "text-emerald-600",
];

/** Four-segment strength bar plus the rule checklist. Required rules are marked; the rest only raise the rating. */
export function PasswordStrengthMeter({
  password,
  extraRules = [],
}: {
  password: string;
  extraRules?: { label: string; ok: boolean }[];
}) {
  const strength = passwordStrength(password, useSecurityPolicy());

  return (
    <div className="space-y-3">
      <div
        className="flex items-center gap-1.5"
        role="status"
        aria-label={`Password strength: ${password ? strength.label : "none"}`}
      >
        {[1, 2, 3, 4].map((segment) => (
          <span
            key={segment}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors duration-300",
              segment <= strength.score ? BAR[strength.score] : BAR[0],
            )}
          />
        ))}
        <span
          className={cn(
            "ml-2 w-16 text-right text-xs font-semibold",
            TEXT[strength.score],
          )}
        >
          {password ? strength.label : "—"}
        </span>
      </div>
      <ul className="grid gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
        {[
          ...strength.rules.map((r) => ({
            key: r.id,
            label: r.label,
            ok: r.met,
            required: r.required,
          })),
          ...extraRules.map((r) => ({
            key: r.label,
            label: r.label,
            ok: r.ok,
            required: true,
          })),
        ].map((rule) => (
          <li
            key={rule.key}
            className={cn(
              "flex items-center gap-1.5 transition-colors",
              rule.ok
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-zinc-500 dark:text-zinc-400",
            )}
          >
            {rule.ok ? (
              <Check size={13} strokeWidth={2.5} />
            ) : (
              <X size={13} className="text-zinc-300 dark:text-zinc-600" />
            )}
            <span>
              {rule.label}
              {rule.required && !rule.ok && (
                <span className="text-red-500"> *</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
