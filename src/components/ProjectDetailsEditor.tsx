"use client";

import { useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, History, Milestone, User } from "lucide-react";
import { Dropdown, type DropdownOption } from "@/components/ui/Dropdown";
import { OwnerSelect } from "@/components/ui/OwnerSelect";
import { ProjectStatusBadge } from "@/components/ProjectStatusBadge";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/formatDate";
import { STATUS_ICONS, TYPE_ICONS } from "@/lib/projectOptionIcons";
import { saveProjectFields } from "@/lib/saveProjectFields";
import {
  PROJECT_STAGES,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  type Project,
  type ProjectStage,
  type ProjectStatus,
  type ProjectType,
} from "@/types/project";

const INLINE_TRIGGER =
  "flex w-full min-w-[11rem] items-center justify-between gap-2 rounded-md border border-orange-400 bg-white px-2 py-1 text-left text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 dark:bg-zinc-900";

const TYPE_OPTIONS: DropdownOption[] = PROJECT_TYPES.map((t) => ({
  value: t,
  label: t,
  icon: TYPE_ICONS[t].icon,
  iconClassName: TYPE_ICONS[t].className,
}));

const STATUS_OPTIONS: DropdownOption[] = PROJECT_STATUSES.map((s) => ({
  value: s,
  label: s.replace("_", " "),
  icon: STATUS_ICONS[s].icon,
  iconClassName: STATUS_ICONS[s].className,
}));

const STAGE_OPTIONS: DropdownOption[] = [
  { value: "", label: "Not set" },
  ...PROJECT_STAGES.map((s) => ({ value: s, label: s })),
];

function DetailsRow({
  icon: Icon,
  iconClassName,
  label,
  children,
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  iconClassName?: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="flex shrink-0 items-center gap-2 text-zinc-500 dark:text-zinc-400">
        <Icon size={14} className={iconClassName} />
        {label}
      </span>
      <div className="min-w-0 text-right">{children}</div>
    </div>
  );
}

function ValueButton({
  label,
  onClick,
  muted,
  children,
}: {
  label: string;
  onClick: () => void;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Edit ${label}`}
      className={cn(
        "-mr-1 rounded-md px-1.5 py-0.5 text-right font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800",
        muted ? "text-zinc-400" : "text-zinc-800 dark:text-zinc-200",
      )}
    >
      {children}
    </button>
  );
}

export function ProjectDetailsEditor({ project }: { project: Project }) {
  const router = useRouter();
  const [local, setLocal] = useState(project);
  const [editing, setEditing] = useState<null | "type" | "status" | "stage" | "owner">(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (project.id !== local.id || project.updatedAt !== local.updatedAt) {
    setLocal(project);
  }

  async function patch(next: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const updated = await saveProjectFields(project.id, next);
      setLocal(updated);
      setEditing(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
      <DetailsRow icon={TYPE_ICONS[local.type].icon} iconClassName={TYPE_ICONS[local.type].className} label="Project Type">
        {editing === "type" ? (
          <Dropdown
            value={local.type}
            options={TYPE_OPTIONS}
            defaultOpen
            aria-label="Project Type"
            className="w-44"
            triggerClassName={INLINE_TRIGGER}
            onChange={(value) => {
              if (saving) return;
              if (value === local.type) {
                setEditing(null);
                return;
              }
              void patch({ type: value as ProjectType });
            }}
            onDismiss={() => setEditing(null)}
          />
        ) : (
          <ValueButton label="Project Type" onClick={() => setEditing("type")}>
            {local.type}
          </ValueButton>
        )}
      </DetailsRow>

      <DetailsRow icon={STATUS_ICONS[local.status].icon} iconClassName={STATUS_ICONS[local.status].className} label="Status">
        {editing === "status" ? (
          <Dropdown
            value={local.status}
            options={STATUS_OPTIONS}
            defaultOpen
            aria-label="Status"
            className="w-44"
            triggerClassName={INLINE_TRIGGER}
            onChange={(value) => {
              if (saving) return;
              if (value === local.status) {
                setEditing(null);
                return;
              }
              void patch({ status: value as ProjectStatus });
            }}
            onDismiss={() => setEditing(null)}
          />
        ) : (
          <ValueButton label="Status" onClick={() => setEditing("status")}>
            <ProjectStatusBadge status={local.status} />
          </ValueButton>
        )}
      </DetailsRow>

      <DetailsRow icon={Milestone} label="Stage">
        {editing === "stage" ? (
          <Dropdown
            value={local.stage ?? ""}
            options={STAGE_OPTIONS}
            defaultOpen
            aria-label="Stage"
            className="w-44"
            triggerClassName={INLINE_TRIGGER}
            onChange={(value) => {
              if (saving) return;
              const next = (value || null) as ProjectStage | null;
              if (next === local.stage) {
                setEditing(null);
                return;
              }
              void patch({ stage: next });
            }}
            onDismiss={() => setEditing(null)}
          />
        ) : (
          <ValueButton label="Stage" muted={!local.stage} onClick={() => setEditing("stage")}>
            {local.stage ?? "Not set"}
          </ValueButton>
        )}
      </DetailsRow>

      <DetailsRow icon={User} label="Owner">
        {editing === "owner" ? (
          <OwnerSelect
            value={local.owner ?? ""}
            defaultOpen
            className="w-52"
            triggerClassName={INLINE_TRIGGER}
            onChange={(value) => {
              if (saving) return;
              const next = value.trim() ? value : null;
              if (next === local.owner) {
                setEditing(null);
                return;
              }
              void patch({ owner: next });
            }}
            onDismiss={() => setEditing(null)}
          />
        ) : (
          <ValueButton label="Owner" muted={!local.owner} onClick={() => setEditing("owner")}>
            {local.owner ?? "Not set"}
          </ValueButton>
        )}
      </DetailsRow>

      <DetailsRow icon={CalendarPlus} label="Created">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">{formatDate(local.createdAt)}</span>
      </DetailsRow>
      <DetailsRow icon={History} label="Last Updated">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">{formatDate(local.updatedAt)}</span>
      </DetailsRow>

      {error && <p className="pt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
