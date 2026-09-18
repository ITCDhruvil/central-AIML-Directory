import { Shield } from "lucide-react";
import { INTERNAL_ACCESS_HINT } from "@/lib/deploymentLabel";
import { cn } from "@/lib/cn";

export function InternalDeployBadge({ className }: { className?: string }) {
  return (
    <span
      title={`Internal server — ${INTERNAL_ACCESS_HINT}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30",
        className,
      )}
    >
      <Shield size={12} />
      Internal
    </span>
  );
}
