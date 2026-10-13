"use client";

import { Switch } from "@/components/ui/Switch";
import { cn } from "@/lib/cn";
import {
  AI_FEATURES,
  DATA_RESOURCES,
  actionsFor,
  allowsOwnScope,
  permissionKey,
  scopeFor,
  type PermissionSet,
  type Scope,
} from "@/lib/auth/permissions";
import { ACTION_LABELS, RESOURCE_LABELS } from "@/lib/auth/permissionLabels";

/** Overrides on top of the role: only keys that differ from the role default are stored. */
export type OverrideMap = Record<string, Scope>;

const COLUMNS = ["view", "create", "edit", "delete"] as const;

function ScopePill({ value, onChange }: { value: "OWN" | "ALL"; onChange: (next: "OWN" | "ALL") => void }) {
  return (
    <div className="inline-flex rounded-lg bg-zinc-100 p-0.5 text-[11px] font-medium dark:bg-zinc-800" role="group" aria-label="Access scope">
      {(["OWN", "ALL"] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={cn(
            "rounded-md px-2.5 py-1 transition-colors",
            value === option
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
              : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200",
          )}
        >
          {option === "OWN" ? "Own" : "All"}
        </button>
      ))}
    </div>
  );
}

/**
 * Permissions on top of a role, as two plain tables. One switch per action and one Own/All control per
 * row, so there are no chips beside every switch. Changes are stored as overrides; anything that matches
 * the role default is dropped, and changed rows get an orange marker.
 */
export function PermissionToggles({
  roleDefaults,
  overrides,
  onChange,
}: {
  roleDefaults: PermissionSet;
  overrides: OverrideMap;
  onChange: (next: OverrideMap) => void;
}) {
  const current = (resource: string, action: string): Scope =>
    overrides[permissionKey(resource, action)] ?? scopeFor(roleDefaults, resource, action);

  function write(changes: [resource: string, action: string, scope: Scope][]) {
    const next = { ...overrides };
    for (const [resource, action, scope] of changes) {
      const key = permissionKey(resource, action);
      if (scope === scopeFor(roleDefaults, resource, action)) delete next[key];
      else next[key] = scope;
    }
    onChange(next);
  }

  /** What the row's Own/All control shows: "All" if any enabled own-capable action is All, else "Own". */
  function rowScope(resource: string): "OWN" | "ALL" | null {
    const enabled = actionsFor(resource)
      .filter((a) => allowsOwnScope(resource, a))
      .map((a) => current(resource, a))
      .filter((s) => s !== "NONE");
    if (enabled.length === 0) return null;
    return enabled.includes("ALL") ? "ALL" : "OWN";
  }

  function toggle(resource: string, action: string) {
    const on = current(resource, action) !== "NONE";
    if (on) return write([[resource, action, "NONE"]]);
    // Turning on takes the row's scope; the narrowest ("Own") when nothing else in the row is on.
    const next: Scope = allowsOwnScope(resource, action) ? (rowScope(resource) ?? "OWN") : "ALL";
    write([[resource, action, next]]);
  }

  function setRowScope(resource: string, scope: "OWN" | "ALL") {
    write(
      actionsFor(resource)
        .filter((a) => allowsOwnScope(resource, a) && current(resource, a) !== "NONE")
        .map((a): [string, string, Scope] => [resource, a, scope]),
    );
  }

  const rowCustomised = (resource: string) => actionsFor(resource).some((a) => permissionKey(resource, a) in overrides);

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400">
              <th className="px-4 py-2.5 text-left font-medium">Area</th>
              {COLUMNS.map((a) => (
                <th key={a} className="px-2 py-2.5 text-center font-medium">
                  {ACTION_LABELS[a]}
                </th>
              ))}
              <th className="px-3 py-2.5 text-center font-medium">Applies to</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {DATA_RESOURCES.map((resource) => {
              const scope = rowScope(resource);
              return (
                <tr key={resource}>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2 font-medium text-zinc-800 dark:text-zinc-100">
                      {RESOURCE_LABELS[resource]}
                      {rowCustomised(resource) && (
                        <span title="Differs from the role default" className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                      )}
                    </span>
                  </td>
                  {COLUMNS.map((action) => (
                    <td key={action} className="px-2 py-2.5 text-center">
                      {actionsFor(resource).includes(action) ? (
                        <Switch
                          checked={current(resource, action) !== "NONE"}
                          label={`${RESOURCE_LABELS[resource]}: ${ACTION_LABELS[action]}`}
                          onChange={() => toggle(resource, action)}
                        />
                      ) : (
                        <span className="text-zinc-300 dark:text-zinc-700">—</span>
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-center">
                    {scope ? (
                      <ScopePill value={scope} onChange={(next) => setRowScope(resource, next)} />
                    ) : (
                      <span className="text-zinc-300 dark:text-zinc-700">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
        <div className="bg-zinc-50 px-4 py-2.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400">
          AI features
        </div>
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {AI_FEATURES.map((resource) => (
            <li key={resource} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                {RESOURCE_LABELS[resource]}
                {rowCustomised(resource) && (
                  <span title="Differs from the role default" className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                )}
              </span>
              <Switch
                checked={current(resource, "use") !== "NONE"}
                label={RESOURCE_LABELS[resource]}
                onChange={() => toggle(resource, "use")}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
