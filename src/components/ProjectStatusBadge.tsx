import type { ProjectStatus } from "@/types/project";
import { cn } from "@/lib/cn";

const STYLES: Record<ProjectStatus, string> = {
  ACTIVE: "bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-500/10 dark:text-green-400 dark:ring-green-500/30",
  COMPLETED: "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/30",
  ON_HOLD: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30",
  ARCHIVED: "bg-zinc-100 text-zinc-500 ring-zinc-600/20 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-600/30",
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", STYLES[status])}>
      {status.replace("_", " ")}
    </span>
  );
}
