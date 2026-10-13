import { Eye, ShieldCheck, User, UserCog } from "lucide-react";
import type { DropdownOption } from "@/components/ui/Dropdown";
import { ROLES } from "@/lib/auth/permissions";
import { ROLE_LABELS } from "@/lib/auth/permissionLabels";

const ICONS = { ADMIN: ShieldCheck, MANAGER: UserCog, MEMBER: User, VIEWER: Eye } as const;
const TONES = {
  ADMIN: "text-orange-600",
  MANAGER: "text-blue-600",
  MEMBER: "text-emerald-600",
  VIEWER: "text-zinc-400",
} as const;

export const ROLE_OPTIONS: DropdownOption[] = ROLES.map((role) => ({
  value: role,
  label: ROLE_LABELS[role],
  icon: ICONS[role],
  iconClassName: TONES[role],
}));

/** Trigger look for form-sized dropdowns on the admin pages. */
export const ADMIN_SELECT_TRIGGER =
  "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-left text-sm text-zinc-900 outline-none transition-colors hover:border-zinc-300 focus-visible:border-orange-500 focus-visible:ring-2 focus-visible:ring-orange-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:border-zinc-600";
