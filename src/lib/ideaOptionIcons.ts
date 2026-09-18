import { Archive, Lightbulb, PauseCircle, Rocket, type LucideIcon } from "lucide-react";
import type { IdeaStatus } from "@/types/idea";

/** Icon + color per idea status, same reuse-everywhere pattern as projectOptionIcons.ts. */
export const IDEA_STATUS_ICONS: Record<IdeaStatus, { icon: LucideIcon; className: string }> = {
  ACTIVE: { icon: Lightbulb, className: "text-amber-500 dark:text-amber-400" },
  ON_HOLD: { icon: PauseCircle, className: "text-zinc-500 dark:text-zinc-400" },
  PROMOTED: { icon: Rocket, className: "text-orange-600 dark:text-orange-400" },
  ARCHIVED: { icon: Archive, className: "text-zinc-400 dark:text-zinc-500" },
};
