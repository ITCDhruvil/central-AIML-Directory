"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/cn";
import type { PreviewSheet } from "@/lib/filePreview";

/** Spreadsheet column letters: 0 -> A, 25 -> Z, 26 -> AA. */
function columnLetter(index: number): string {
  let n = index;
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

const number = (n: number) => n.toLocaleString("en-US");

/** Sheet tabs, a filter box and a table with a sticky header, for an Excel or CSV file's preview. */
export function SpreadsheetViewer({ sheets }: { sheets: PreviewSheet[] }) {
  const [active, setActive] = useState(0);
  const [query, setQuery] = useState("");
  const sheet = sheets[Math.min(active, sheets.length - 1)];

  // The first row is treated as the header: it stays visible while scrolling and is left out of filtering.
  const [header = [], ...body] = sheet?.rows ?? [];
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? body.filter((row) => row.some((cell) => cell.toLowerCase().includes(q))) : body;
  }, [body, query]);

  if (sheets.length === 0) return <p className="px-6 py-10 text-center text-sm text-zinc-500">This file has no sheets.</p>;

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-3 py-2.5 dark:border-zinc-800">
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto" role="tablist" aria-label="Sheets">
          {sheets.map((s, i) => (
            <button
              key={`${s.name}-${i}`}
              type="button"
              role="tab"
              aria-selected={i === active}
              onClick={() => {
                setActive(i);
                setQuery("");
              }}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                i === active
                  ? "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400"
                  : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800",
              )}
            >
              {s.name}
              <span className="ml-1.5 tabular-nums text-zinc-400">{number(s.totalRows)}</span>
            </button>
          ))}
        </div>
        <label className="relative">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter rows"
            className="w-44 rounded-lg border border-zinc-200 bg-transparent py-1.5 pl-8 pr-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-orange-500 focus:outline-none dark:border-zinc-700 dark:text-zinc-100"
          />
        </label>
      </div>

      {sheet.rows.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-zinc-500">This sheet is empty.</p>
      ) : (
        <div className="max-h-[calc(100vh-18rem)] min-h-[16rem] overflow-auto">
          <table className="w-max min-w-full border-separate border-spacing-0 text-left text-xs">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="sticky left-0 z-20 w-10 border-b border-r border-zinc-200 bg-zinc-100 px-2 py-1.5 text-center font-normal text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800" />
                {header.map((cell, i) => (
                  <th
                    key={i}
                    className="max-w-[18rem] whitespace-nowrap border-b border-zinc-200 bg-zinc-100 px-3 py-1.5 font-semibold text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    title={cell}
                  >
                    <span className="mr-2 font-normal text-zinc-400">{columnLetter(i)}</span>
                    <span className="truncate">{cell}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((row, r) => (
                <tr key={r} className="odd:bg-transparent even:bg-zinc-50/70 hover:bg-orange-50/50 dark:even:bg-zinc-800/30 dark:hover:bg-orange-500/5">
                  <td className="sticky left-0 border-r border-zinc-100 bg-inherit px-2 py-1.5 text-center tabular-nums text-zinc-400 dark:border-zinc-800">{r + 2}</td>
                  {row.map((cell, c) => (
                    <td key={c} className="max-w-[18rem] truncate whitespace-nowrap border-b border-zinc-100 px-3 py-1.5 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300" title={cell}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length === 0 && <p className="px-6 py-8 text-center text-sm text-zinc-500">No rows match “{query}”.</p>}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 px-4 py-2 text-xs text-zinc-400 dark:border-zinc-800">
        <span>
          {number(sheet.totalRows)} row{sheet.totalRows === 1 ? "" : "s"} · {number(sheet.totalCols)} column{sheet.totalCols === 1 ? "" : "s"}
        </span>
        {sheet.truncated && <span>Preview shows the first 1,000 rows and 60 columns. Download the file for everything.</span>}
        {query.trim() && <span>{number(shown.length)} matching</span>}
      </div>
    </div>
  );
}
