"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CornerDownLeft, FileText, FolderKanban, Lightbulb, Loader2, Search, X, type LucideIcon } from "lucide-react";
import { useClickOutside } from "@/lib/useClickOutside";
import { cn } from "@/lib/cn";
import type { SearchResponse, SnippetSegment } from "@/lib/search/types";

const EMPTY: SearchResponse = { query: "", projects: [], ideas: [], documentation: [] };

type Item = { key: string; group: string; href: string; icon: LucideIcon; title: string; sub?: string; hint: string; snippet?: SnippetSegment[] | null };

export function GlobalSearch({ variant = "compact" }: { variant?: "compact" | "icon" }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const homeQ = searchParams.get("q") ?? "";
  const [q, setQ] = useState(() => (pathname === "/" ? homeQ : ""));
  const [prevPath, setPrevPath] = useState(pathname);
  const [prevHomeQ, setPrevHomeQ] = useState(homeQ);
  const [open, setOpen] = useState(false);
  const [iconOpen, setIconOpen] = useState(false);
  const [prevVariant, setPrevVariant] = useState(variant);
  const [result, setResult] = useState<SearchResponse>(EMPTY);
  const [active, setActive] = useState(0);
  const [loading, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRow = useRef<HTMLAnchorElement>(null);
  // Answers already fetched in this session, so typing a word again (or backspacing) is instant.
  const cache = useRef(new Map<string, SearchResponse>());

  if (pathname !== prevPath || (pathname === "/" && homeQ !== prevHomeQ)) {
    setPrevPath(pathname);
    setPrevHomeQ(homeQ);
    if (pathname === "/") setQ(homeQ);
  }
  if (variant !== prevVariant) {
    setPrevVariant(variant);
    setOpen(false);
    setIconOpen(false);
  }

  const panelOpen = variant === "icon" ? iconOpen : true;
  useClickOutside(ref, () => {
    setOpen(false);
    setIconOpen(false);
  }, open || iconOpen);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
      if (e.key.toLowerCase() !== "k") return;
      e.preventDefault();
      if (variant === "icon") setIconOpen(true);
      setOpen(true);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [variant]);

  const trimmed = q.trim();

  useEffect(() => {
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    const hit = cache.current.get(key);
    const controller = new AbortController();
    const timeout = setTimeout(
      () => {
        if (hit) {
          setResult(hit);
          return;
        }
        startTransition(async () => {
          try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
            if (!res.ok) return;
            const body = (await res.json()) as SearchResponse;
            const next = { query: body.query ?? trimmed, projects: body.projects ?? [], ideas: body.ideas ?? [], documentation: body.documentation ?? [] };
            cache.current.set(key, next);
            // The previous results stay on screen until these arrive, so the panel never blanks while typing.
            setResult(next);
          } catch (err) {
            if (!(err instanceof Error) || err.name !== "AbortError") setResult(EMPTY);
          }
        });
      },
      hit ? 0 : 70,
    );
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [trimmed]);

  const items = useMemo<Item[]>(
    () => [
      ...result.projects.map((r) => ({ key: `p-${r.project.id}`, group: "Projects", href: `/projects/${r.project.id}`, icon: FolderKanban, title: r.project.name, hint: r.project.type })),
      ...result.ideas.map((r) => ({ key: `i-${r.idea.id}`, group: "Ideas", href: `/ideas/${r.idea.id}`, icon: Lightbulb, title: r.idea.name, hint: r.idea.status.replace("_", " ") })),
      ...result.documentation.map((r) => ({
        key: `d-${r.document.id}`,
        group: "Documentation",
        href: `/projects/${r.project.id}/documents/${r.document.id}`,
        icon: FileText,
        title: r.document.title,
        sub: r.project.name,
        hint: r.document.category,
        snippet: r.snippet,
      })),
    ],
    [result],
  );
  const groups = [...new Set(items.map((i) => i.group))];

  const hasResults = items.length > 0;
  const showPanel = open && trimmed.length > 0 && panelOpen;
  const current = Math.min(active, Math.max(0, items.length - 1));

  useEffect(() => {
    activeRow.current?.scrollIntoView({ block: "nearest" });
  }, [current, items]);

  function goToFullResults() {
    if (!trimmed) return;
    setOpen(false);
    setIconOpen(false);
    router.push(`/?q=${encodeURIComponent(trimmed)}`);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const picked = items[current];
    if (picked && showPanel) {
      closeAfterPick();
      router.push(picked.href);
    } else goToFullResults();
  }

  function closeAfterPick() {
    setOpen(false);
    setIconOpen(false);
  }

  function clear() {
    setQ("");
    setResult(EMPTY);
    setOpen(false);
    inputRef.current?.focus();
  }

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" && items.length) {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp" && items.length) {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Escape") {
      if (q) clear();
      else {
        setOpen(false);
        setIconOpen(false);
      }
    }
  }

  const results = showPanel && (
    <div
      className={cn(
        "overflow-hidden rounded-2xl bg-white text-sm shadow-[0_16px_48px_rgba(24,24,27,0.2)] ring-1 ring-zinc-200/80 dark:bg-zinc-900 dark:ring-zinc-800",
        variant === "icon" ? "mt-2" : "absolute left-full top-0 z-50 ml-2 w-[30rem] max-w-[calc(100vw-6rem)]",
      )}
    >
      <div className="max-h-[min(34rem,70vh)] overflow-y-auto py-1">
        {!hasResults ? (
          <p className="flex items-center gap-2 px-4 py-6 text-zinc-400">
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Searching…
              </>
            ) : (
              <>No results for &quot;{trimmed}&quot;</>
            )}
          </p>
        ) : (
          groups.map((g) => (
            <div key={g} className="py-1">
              <p className="px-4 py-1 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                {g} <span className="font-normal normal-case tracking-normal">{items.filter((i) => i.group === g).length}</span>
              </p>
              {items.map((item, index) =>
                item.group !== g ? null : (
                  <Link
                    key={item.key}
                    ref={index === current ? activeRow : null}
                    href={item.href}
                    onClick={closeAfterPick}
                    onMouseMove={() => setActive(index)}
                    className={cn("mx-2 flex items-start gap-3 rounded-lg px-2.5 py-2 text-zinc-700 dark:text-zinc-200", index === current && "bg-zinc-100 dark:bg-zinc-800")}
                  >
                    <item.icon size={16} className="mt-0.5 shrink-0 text-zinc-400" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{item.title}</span>
                      {item.sub && <span className="block truncate text-xs text-zinc-400">{item.sub}</span>}
                      {item.snippet && item.snippet.length > 0 && (
                        <span className="mt-0.5 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
                          {item.snippet.map((s, i) =>
                            s.highlighted ? (
                              <mark key={i} className="rounded-sm bg-orange-100 px-0.5 text-zinc-900 dark:bg-orange-500/25 dark:text-zinc-100">
                                {s.text}
                              </mark>
                            ) : (
                              <span key={i}>{s.text}</span>
                            ),
                          )}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 shrink-0 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">{item.hint}</span>
                  </Link>
                ),
              )}
            </div>
          ))
        )}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-zinc-100 bg-zinc-50/70 px-4 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/40">
        <span className="hidden items-center gap-3 sm:flex">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-zinc-200 bg-white px-1 font-sans dark:border-zinc-700 dark:bg-zinc-900">↑</kbd>
            <kbd className="rounded border border-zinc-200 bg-white px-1 font-sans dark:border-zinc-700 dark:bg-zinc-900">↓</kbd> move
          </span>
          <span className="flex items-center gap-1">
            <CornerDownLeft size={12} /> open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-zinc-200 bg-white px-1 font-sans dark:border-zinc-700 dark:bg-zinc-900">esc</kbd> clear
          </span>
        </span>
        <button type="button" onClick={goToFullResults} className="ml-auto flex items-center gap-1.5 font-medium text-zinc-700 hover:text-orange-600 dark:text-zinc-300 dark:hover:text-orange-400">
          <Search size={13} /> View all results
        </button>
      </div>
    </div>
  );

  const field = (
    <form onSubmit={handleSubmit}>
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          ref={inputRef}
          id="global-search"
          type="text"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls="global-search-results"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => {
            if (trimmed) setOpen(true);
          }}
          onKeyDown={onInputKey}
          placeholder="Search"
          className="w-full rounded-xl bg-zinc-100 py-2 pl-8 pr-9 text-[13px] text-zinc-800 placeholder:text-zinc-400 outline-none ring-0 transition-shadow focus:ring-2 focus:ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-zinc-700"
          autoComplete="off"
          spellCheck={false}
        />
        {q ? (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear search"
            title="Clear"
            className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
          >
            <X size={14} />
          </button>
        ) : (
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 bg-transparent font-sans text-[11px] font-normal text-zinc-400">ctrl + K</kbd>
        )}
      </div>
    </form>
  );

  if (variant === "icon") {
    return (
      <div ref={ref} className="relative flex justify-center">
        <button
          type="button"
          title="Search"
          aria-label="Search"
          onClick={() => {
            setIconOpen((v) => !v);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
            iconOpen && "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100",
          )}
        >
          <Search size={21} strokeWidth={1.75} />
        </button>
        {iconOpen && (
          <div id="global-search-results" className="absolute left-full top-0 z-50 ml-2 w-[30rem] max-w-[calc(100vw-6rem)] rounded-2xl bg-white p-2 shadow-[0_8px_30px_rgba(24,24,27,0.12)] ring-1 ring-zinc-200/80 dark:bg-zinc-900 dark:ring-zinc-800">
            {field}
            {results}
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative w-full">
      {field}
      <div id="global-search-results">{results}</div>
    </div>
  );
}
