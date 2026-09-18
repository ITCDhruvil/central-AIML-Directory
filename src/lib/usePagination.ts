"use client";

import { useState } from "react";

/**
 * Client-side pagination over an already-loaded array. `page` self-clamps to
 * the valid range each render (e.g. after a search shrinks the list), so
 * callers only need to call `setPage(1)` when they want an explicit reset
 * (e.g. on a new search query).
 */
export function usePagination<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    page: safePage,
    setPage,
    totalPages,
    pageItems: items.slice(start, start + pageSize),
    totalItems: items.length,
  };
}
