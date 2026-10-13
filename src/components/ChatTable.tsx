"use client";

import {
  Children,
  isValidElement,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { Search } from "lucide-react";
import { Pagination } from "@/components/ui/Pagination";
import { matchesText, paginate, textOf } from "@/lib/tableView";

const PAGE_SIZE = 5;

/**
 * A table inside a chat reply. Small tables look as they are; once there are more rows than fit on a page, a search box
 * and page controls appear above and below. The rows come from the markdown renderer, so cells keep their links.
 */
export function ChatTable({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const parts = Children.toArray(children).filter(
    isValidElement,
  ) as ReactElement<{ children?: ReactNode }>[];
  const head = parts.find((p) => p.type === "thead");
  const body = parts.find((p) => p.type === "tbody");
  const rows = Children.toArray(body?.props.children).filter(isValidElement);

  const frame = (content: ReactNode) => (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full border-collapse text-[13px]">{content}</table>
    </div>
  );

  // Not a table we can page (no body rows found): show it exactly as it came.
  if (!body || rows.length === 0)
    return <div className="my-3">{frame(children)}</div>;

  const searchable = rows.length > PAGE_SIZE;
  const matching = rows.filter((row) => matchesText(textOf(row), query));
  const current = paginate(matching, page, PAGE_SIZE);

  return (
    <div className="my-3">
      {searchable && (
        <div className="mb-2 flex items-center gap-3">
          <div className="relative w-full max-w-56">
            <Search
              size={13}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search this table…"
              aria-label="Search this table"
              className="h-8 w-full rounded-md border border-zinc-200 bg-white pl-8 pr-2 text-xs text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>
          <span className="shrink-0 text-xs text-zinc-400" aria-live="polite">
            {query.trim()
              ? `${matching.length} of ${rows.length}`
              : `${rows.length} rows`}
          </span>
        </div>
      )}

      {frame(
        <>
          {head}
          <tbody>{current.items}</tbody>
        </>,
      )}

      {searchable && matching.length === 0 && (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          No rows match “{query.trim()}”.
        </p>
      )}
      {searchable && (
        <Pagination
          page={current.page}
          totalPages={current.totalPages}
          onPageChange={setPage}
          className="pt-2"
        />
      )}
    </div>
  );
}
