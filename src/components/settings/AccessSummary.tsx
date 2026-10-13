"use client";

import { Check, Minus } from "lucide-react";
import { SettingsCard } from "@/components/settings/SettingsCard";
import {
  ACTION_LABELS,
  RESOURCE_LABELS,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
} from "@/lib/auth/permissionLabels";
import {
  AI_FEATURES,
  DATA_RESOURCES,
  actionsFor,
  scopeFor,
  type Scope,
} from "@/lib/auth/permissions";
import type { AuthUser } from "@/lib/auth/types";
import { cn } from "@/lib/cn";

const COLUMNS = ["view", "create", "edit", "delete"] as const;

function ScopeBadge({ scope }: { scope: Scope }) {
  if (scope === "NONE")
    return (
      <Minus
        size={14}
        className="mx-auto text-zinc-300 dark:text-zinc-600"
        aria-label="No access"
      />
    );
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        scope === "ALL"
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
          : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
      )}
    >
      {scope === "ALL" ? "All" : "Own"}
    </span>
  );
}

/** Read-only view of what the signed-in user's role and overrides allow, so nobody has to guess why a button is missing. */
export function AccessSummary({ user }: { user: AuthUser }) {
  // Resources the user has no access to at all (users, settings…) are listed too, so the table is the same for everyone.
  const rows = DATA_RESOURCES.map((resource) => ({
    resource,
    actions: actionsFor(resource),
  }));
  const ai = AI_FEATURES.map((feature) => ({
    feature,
    allowed: scopeFor(user.permissions, feature, "use") !== "NONE",
  }));

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <SettingsCard
        title="My access"
        description={`You are a ${ROLE_LABELS[user.role]}. ${ROLE_DESCRIPTIONS[user.role]}`}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <th className="py-2 pr-3 font-medium">Area</th>
                {COLUMNS.map((c) => (
                  <th key={c} className="px-3 py-2 text-center font-medium">
                    {ACTION_LABELS[c]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {rows.map(({ resource, actions }) => (
                <tr key={resource}>
                  <td className="py-2.5 pr-3 font-medium text-zinc-800 dark:text-zinc-200">
                    {RESOURCE_LABELS[resource]}
                  </td>
                  {COLUMNS.map((c) => (
                    <td key={c} className="px-3 py-2.5 text-center">
                      {actions.includes(c) ? (
                        <ScopeBadge
                          scope={scopeFor(user.permissions, resource, c)}
                        />
                      ) : (
                        <span className="text-zinc-300 dark:text-zinc-700">
                          ·
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
          <strong className="font-medium text-zinc-700 dark:text-zinc-300">
            All
          </strong>{" "}
          means everything in the directory.{" "}
          <strong className="font-medium text-zinc-700 dark:text-zinc-300">
            Own
          </strong>{" "}
          means only items you own or that were shared with you.
        </p>
      </SettingsCard>

      <SettingsCard title="AI features" description="Assistants you can use.">
        <ul className="grid gap-2">
          {ai.map(({ feature, allowed }) => (
            <li
              key={feature}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                allowed
                  ? "border-emerald-200 bg-emerald-50/50 text-zinc-800 dark:border-emerald-500/20 dark:bg-emerald-500/5 dark:text-zinc-200"
                  : "border-zinc-200 text-zinc-400 dark:border-zinc-800",
              )}
            >
              {allowed ? (
                <Check size={15} className="text-emerald-600" />
              ) : (
                <Minus size={15} />
              )}
              {RESOURCE_LABELS[feature]}
            </li>
          ))}
        </ul>
      </SettingsCard>
    </div>
  );
}
