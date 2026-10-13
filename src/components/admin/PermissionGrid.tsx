"use client";

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
import { ACTION_LABELS, RESOURCE_HINTS, RESOURCE_LABELS } from "@/lib/auth/permissionLabels";

const ACTION_COLUMNS = ["view", "create", "edit", "delete"] as const;

/** Per-key values. In user mode a missing key / null means "inherit the role default". */
export type GridValues = Record<string, Scope | null | undefined>;

const SCOPE_LABEL: Record<Scope, string> = { NONE: "Off", OWN: "Own", ALL: "All" };

function Segment({
  active,
  tone,
  onClick,
  disabled,
  children,
  title,
}: {
  active: boolean;
  tone: "neutral" | "on" | "off";
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
      className={cn(
        "h-7 rounded-md px-2 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        active
          ? tone === "on"
            ? "bg-orange-600 text-white"
            : tone === "off"
              ? "bg-zinc-700 text-white dark:bg-zinc-300 dark:text-zinc-900"
              : "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-50"
          : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800",
      )}
    >
      {children}
    </button>
  );
}

function Cell({
  resource,
  action,
  mode,
  values,
  effectiveDefaults,
  readOnly,
  onChange,
}: {
  resource: string;
  action: string;
  mode: "role" | "user";
  values: GridValues;
  effectiveDefaults: PermissionSet;
  readOnly: boolean;
  onChange: (key: string, scope: Scope | null) => void;
}) {
  if (!actionsFor(resource).includes(action as never)) {
    return <span className="text-zinc-300 dark:text-zinc-700">—</span>;
  }
  const key = permissionKey(resource, action);
  const explicit = values[key];
  const inherits = mode === "user" && (explicit === undefined || explicit === null);
  const roleDefault = scopeFor(effectiveDefaults, resource, action);
  const current: Scope = inherits ? roleDefault : (explicit ?? "NONE");
  const scopes: Scope[] = allowsOwnScope(resource, action) ? ["NONE", "OWN", "ALL"] : ["NONE", "ALL"];

  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg bg-zinc-50 p-0.5 ring-1 ring-zinc-200 dark:bg-zinc-950 dark:ring-zinc-800">
      {mode === "user" && (
        <Segment
          active={inherits}
          tone="neutral"
          disabled={readOnly}
          title={`Use the role default (${SCOPE_LABEL[roleDefault]})`}
          onClick={() => onChange(key, null)}
        >
          Default
        </Segment>
      )}
      {scopes.map((scope) => (
        <Segment
          key={scope}
          active={!inherits && current === scope}
          tone={scope === "NONE" ? "off" : "on"}
          disabled={readOnly}
          onClick={() => onChange(key, scope)}
        >
          {scope === "ALL" && !allowsOwnScope(resource, action) ? "On" : SCOPE_LABEL[scope]}
        </Segment>
      ))}
      {inherits && (
        <span className="px-1.5 text-[10px] text-zinc-400" title="Effective value from the role">
          = {SCOPE_LABEL[roleDefault]}
        </span>
      )}
    </div>
  );
}

function Section({
  title,
  resources,
  columns,
  ...cellProps
}: {
  title: string;
  resources: readonly string[];
  columns: readonly string[];
} & Omit<React.ComponentProps<typeof Cell>, "resource" | "action">) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-zinc-100 text-left text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            <th className="px-4 py-2.5 font-medium">{title}</th>
            {columns.map((action) => (
              <th key={action} className="px-3 py-2.5 font-medium">
                {ACTION_LABELS[action]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {resources.map((resource) => (
            <tr key={resource}>
              <td className="px-4 py-2.5 align-middle">
                <div className="font-medium text-zinc-800 dark:text-zinc-100">{RESOURCE_LABELS[resource] ?? resource}</div>
                {RESOURCE_HINTS[resource] && (
                  <div className="text-[11px] text-zinc-400">{RESOURCE_HINTS[resource]}</div>
                )}
              </td>
              {columns.map((action) => (
                <td key={action} className="px-3 py-2.5 align-middle">
                  <Cell resource={resource} action={action} {...cellProps} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Toggle matrix for permissions: one row per area, one column per action.
 * `role` mode edits a role's defaults; `user` mode edits one user's overrides on top of their role.
 */
export function PermissionGrid({
  mode,
  values,
  effectiveDefaults,
  readOnly = false,
  onChange,
}: {
  mode: "role" | "user";
  values: GridValues;
  /** Effective permissions of the role (shown as "Default = …" in user mode; also the base in role mode). */
  effectiveDefaults: PermissionSet;
  readOnly?: boolean;
  onChange: (key: string, scope: Scope | null) => void;
}) {
  const common = { mode, values, effectiveDefaults, readOnly, onChange };
  return (
    <div className="space-y-4">
      <Section title="Data and pages" resources={DATA_RESOURCES} columns={ACTION_COLUMNS} {...common} />
      <Section title="AI features" resources={AI_FEATURES} columns={["use"]} {...common} />
    </div>
  );
}
