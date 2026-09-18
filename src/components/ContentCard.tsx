import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export type CardTone = "rose" | "sky" | "amber" | "emerald" | "violet";

const TONE_PANEL: Record<CardTone, string> = {
  rose: "bg-rose-100 dark:bg-rose-500/15",
  sky: "bg-sky-100 dark:bg-sky-500/15",
  amber: "bg-amber-100 dark:bg-amber-500/15",
  emerald: "bg-emerald-100 dark:bg-emerald-500/15",
  violet: "bg-violet-100 dark:bg-violet-500/15",
};

export interface ContentCardStat {
  icon: LucideIcon;
  label: string;
}

export function ContentCard({
  href,
  tone,
  badge,
  extraBadge,
  visual,
  title,
  description,
  stats,
  footerLeft,
  menu,
  visitHref,
  visitHint,
}: {
  href: string;
  tone: CardTone;
  badge: string;
  extraBadge?: React.ReactNode;
  visual: React.ReactNode;
  title: string;
  description: string | null;
  stats: ContentCardStat[];
  footerLeft: string;
  menu?: React.ReactNode;
  visitHref?: string | null;
  visitHint?: string;
}) {
  return (
    <article className="flex flex-col rounded-lg border border-zinc-200/80 bg-white p-1.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className={cn("relative flex min-h-0 flex-1 flex-col rounded-md px-5 pb-5 pt-4", TONE_PANEL[tone])}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-white/70 px-2.5 py-0.5 text-[11px] font-medium text-zinc-500 dark:bg-zinc-950/40 dark:text-zinc-300">
                {badge}
              </span>
              {extraBadge}
            </div>
            <Link href={href} className="mt-3 block">
              <h3 className="break-words text-xl font-semibold tracking-tight text-zinc-900 hover:underline dark:text-zinc-50">
                {title}
              </h3>
            </Link>
            {description ? (
              <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</p>
            ) : (
              <p className="mt-1.5 text-sm text-zinc-400">No description yet.</p>
            )}
          </div>
          <div className="flex h-[4.75rem] w-[4.75rem] shrink-0 items-center justify-center rounded-full bg-white/80 text-zinc-700 shadow-sm dark:bg-zinc-950/40 dark:text-zinc-200">
            {visual}
          </div>
        </div>

        {stats.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-600 dark:text-zinc-300">
            {stats.map((stat, i) => (
              <span key={stat.label} className="inline-flex items-center gap-1.5">
                {i > 0 && <span className="text-zinc-300 dark:text-zinc-600">·</span>}
                <stat.icon size={15} className="shrink-0 text-zinc-400" />
                {stat.label}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <p className="min-w-0 truncate text-sm text-zinc-500 dark:text-zinc-400">{footerLeft}</p>
        <div className="flex shrink-0 items-center gap-1.5">
          {menu}
          {visitHref && (
            <a
              href={visitHref}
              target="_blank"
              rel="noopener noreferrer"
              title={visitHint}
              className={CARD_SECONDARY_CTA_CLASS}
            >
              Visit
            </a>
          )}
          <Link href={href} className={CARD_CTA_CLASS}>
            Explore
          </Link>
        </div>
      </div>
    </article>
  );
}

/** Shared by Explore and Save as idea so catalog and insight cards use one CTA. */
export const CARD_CTA_CLASS =
  "inline-flex items-center justify-center gap-1.5 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950";

export const CARD_SECONDARY_CTA_CLASS =
  "inline-flex items-center justify-center gap-1.5 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950";

/** Shared project/idea card grid: 1 → 2 → 3 → 4 columns as the viewport grows. */
export const CARD_GRID_CLASS = "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4";

export function formatCardDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
}

export function formatCardDateTime(iso: string): string {
  const date = formatCardDate(iso);
  const d = new Date(iso);
  const hours = String(d.getUTCHours()).padStart(2, "0");
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");
  return `${date}, ${hours}:${minutes}`;
}

export function toneFromId(id: string): CardTone {
  const tones: CardTone[] = ["rose", "sky", "amber", "emerald"];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return tones[hash % tones.length];
}
