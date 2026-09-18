import Link from "next/link";
import { Lightbulb } from "lucide-react";
import type { Idea } from "@/types/idea";
import { IdeaStatusBadge } from "@/components/IdeaStatusBadge";
import { IdeaCardMenu } from "@/components/IdeaCardMenu";
import { stripMarkdown } from "@/lib/stripMarkdown";

export function IdeaListRow({ idea }: { idea: Idea }) {
  return (
    <div className="flex items-center gap-4 bg-white px-5 py-4 transition-colors hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800/60">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-500 dark:bg-amber-500/10 dark:text-amber-400">
        <Lightbulb size={22} />
      </div>

      <div className="min-w-0 flex-1">
        <Link href={`/ideas/${idea.id}`} className="block truncate text-base font-semibold text-zinc-900 hover:underline dark:text-zinc-100">
          {idea.name}
        </Link>
        {idea.description && (
          <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">{stripMarkdown(idea.description)}</p>
        )}
      </div>

      <div className="hidden w-32 shrink-0 items-center sm:flex">
        <IdeaStatusBadge status={idea.status} />
      </div>

      <IdeaCardMenu id={idea.id} name={idea.name} promoted={idea.status === "PROMOTED"} />
    </div>
  );
}
