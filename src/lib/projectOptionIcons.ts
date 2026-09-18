import {
  Archive,
  Boxes,
  CheckCheck,
  CircleCheck,
  FlaskConical,
  MoreHorizontal,
  PauseCircle,
  TestTube,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { ProjectStatus, ProjectType } from "@/types/project";

/** Icon + color per project type/status, matching ProjectTypeBadge/ProjectStatusBadge's existing color scheme — reused everywhere a Type/Status dropdown appears. */
export const TYPE_ICONS: Record<ProjectType, { icon: LucideIcon; className: string }> = {
  PROJECT: { icon: Boxes, className: "text-blue-600 dark:text-blue-400" },
  POC: { icon: FlaskConical, className: "text-orange-600 dark:text-orange-400" },
  EXPERIMENT: { icon: TestTube, className: "text-amber-600 dark:text-amber-400" },
  TOOL: { icon: Wrench, className: "text-teal-600 dark:text-teal-400" },
  OTHER: { icon: MoreHorizontal, className: "text-zinc-500 dark:text-zinc-400" },
};

export const STATUS_ICONS: Record<ProjectStatus, { icon: LucideIcon; className: string }> = {
  ACTIVE: { icon: CircleCheck, className: "text-green-600 dark:text-green-400" },
  COMPLETED: { icon: CheckCheck, className: "text-blue-600 dark:text-blue-400" },
  ON_HOLD: { icon: PauseCircle, className: "text-amber-600 dark:text-amber-400" },
  ARCHIVED: { icon: Archive, className: "text-zinc-500 dark:text-zinc-400" },
};
