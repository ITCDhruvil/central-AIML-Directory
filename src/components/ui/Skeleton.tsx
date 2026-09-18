import { cn } from "@/lib/cn";
import { CARD_GRID_CLASS } from "@/components/ContentCard";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800", className)} />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-1.5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="rounded-md bg-zinc-100 p-5 dark:bg-zinc-800">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="mt-6 h-6 w-2/3" />
        <Skeleton className="mt-2 h-3 w-full" />
        <Skeleton className="mt-1 h-3 w-4/5" />
      </div>
      <div className="flex items-center justify-between px-3 py-2.5">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-20 rounded-md" />
      </div>
    </div>
  );
}

export function SkeletonCardGrid({ count = 6 }: { count?: number }) {
  return (
    <div className={CARD_GRID_CLASS}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
