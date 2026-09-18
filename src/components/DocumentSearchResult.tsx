import Link from "next/link";
import type { DocumentationSearchResult } from "@/lib/search/types";

export function DocumentSearchResult({ result }: { result: DocumentationSearchResult }) {
  return (
    <Link
      href={`/projects/${result.project.id}/documents/${result.document.id}`}
      className="block rounded-lg border border-zinc-200 bg-white p-3 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{result.document.title}</span>
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          {result.document.category}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{result.project.name}</p>
      {result.snippet && (
        <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-300">
          {result.snippet.map((segment, i) =>
            segment.highlighted ? (
              <mark key={i} className="rounded bg-amber-200 px-0.5 dark:bg-amber-900 dark:text-amber-100">
                {segment.text}
              </mark>
            ) : (
              <span key={i}>{segment.text}</span>
            ),
          )}
        </p>
      )}
    </Link>
  );
}
