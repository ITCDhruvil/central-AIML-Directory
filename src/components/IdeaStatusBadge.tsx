import type { IdeaStatus } from "@/types/idea";
import { cn } from "@/lib/cn";

const STYLES: Record<IdeaStatus, string> = {
  ACTIVE: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30",
  ON_HOLD: "bg-zinc-100 text-zinc-500 ring-zinc-600/20 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-600/30",
  PROMOTED: "bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-500/10 dark:text-orange-400 dark:ring-orange-500/30",
  ARCHIVED: "bg-zinc-100 text-zinc-500 ring-zinc-600/20 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-600/30",
};

export function IdeaStatusBadge({ status }: { status: IdeaStatus }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", STYLES[status])}>
      {status.replace("_", " ")}
    </span>
  );
}
