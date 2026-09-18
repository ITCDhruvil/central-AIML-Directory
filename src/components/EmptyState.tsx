import { Inbox, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
  icon: Icon = Inbox,
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 px-6 py-16 text-center dark:border-zinc-700">
      <Icon size={22} className="text-zinc-300 dark:text-zinc-600" />
      <h3 className="mt-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
      {actionHref && actionLabel && (
        <Button href={actionHref} variant="primary" className="mt-4">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
