"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FileText, FolderKanban, Lightbulb, Search } from "lucide-react";
import { useClickOutside } from "@/lib/useClickOutside";
import { cn } from "@/lib/cn";
import type { SearchResponse } from "@/lib/search/types";

const EMPTY: SearchResponse = { query: "", projects: [], ideas: [], documentation: [] };

export function GlobalSearch({
  variant = "compact",
}: {
  variant?: "compact" | "icon";
}) {
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
  const [loading, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [variant]);

  const trimmed = q.trim();

  useEffect(() => {
    if (!trimmed) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      startTransition(async () => {
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
          if (!res.ok) return;
          const body = (await res.json()) as SearchResponse;
          setResult({
            query: body.query ?? trimmed,
            projects: body.projects ?? [],
            ideas: body.ideas ?? [],
            documentation: body.documentation ?? [],
          });
        } catch (err) {
          if (!(err instanceof Error) || err.name !== "AbortError") setResult(EMPTY);
        }
      });
    }, 180);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [trimmed]);

  const hasResults = result.projects.length > 0 || result.ideas.length > 0 || result.documentation.length > 0;
  const showPanel = open && trimmed.length > 0 && panelOpen;

  function goToFullResults() {
    if (!trimmed) return;
    setOpen(false);
    setIconOpen(false);
    router.push(`/?q=${encodeURIComponent(trimmed)}`);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    goToFullResults();
  }

  function closeAfterPick() {
    setOpen(false);
    setIconOpen(false);
  }

  const results = showPanel && (
    <div
      className={cn(
        "overflow-auto rounded-2xl bg-white py-1 text-sm shadow-[0_12px_40px_rgba(24,24,27,0.16)] ring-1 ring-zinc-200/80 dark:bg-zinc-900 dark:ring-zinc-800",
        variant === "icon" ? "mt-2 max-h-80" : "absolute left-full top-0 z-50 ml-2 max-h-96 w-80",
      )}
    >
      {loading && !hasResults ? (
        <p className="px-3 py-2 text-zinc-400">Searching...</p>
      ) : !hasResults ? (
        <p className="px-3 py-2 text-zinc-400">No results for &quot;{trimmed}&quot;</p>
      ) : (
        <>
          {result.projects.length > 0 && (
            <ResultGroup label="Projects">
              {result.projects.map((r) => (
                <ResultLink
                  key={r.project.id}
                  href={`/projects/${r.project.id}`}
                  icon={FolderKanban}
                  title={r.project.name}
                  hint={r.project.type}
                  onPick={closeAfterPick}
                />
              ))}
            </ResultGroup>
          )}
          {result.ideas.length > 0 && (
            <ResultGroup label="Ideas">
              {result.ideas.map((r) => (
                <ResultLink
                  key={r.idea.id}
                  href={`/ideas/${r.idea.id}`}
                  icon={Lightbulb}
                  title={r.idea.name}
                  hint={r.idea.status.replace("_", " ")}
                  onPick={closeAfterPick}
                />
              ))}
            </ResultGroup>
          )}
          {result.documentation.length > 0 && (
            <ResultGroup label="Documentation">
                  {result.documentation.map((r) => (
                    <ResultLink
                      key={r.document.id}
                      href={`/projects/${r.project.id}/documents/${r.document.id}`}
                      icon={FileText}
                      title={r.document.title}
                      hint={r.project.name}
                      onPick={closeAfterPick}
                    />
                  ))}
            </ResultGroup>
          )}
          <button
            type="button"
            onClick={goToFullResults}
            className="flex w-full items-center gap-2 border-t border-zinc-100 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <Search size={14} />
            View all results
          </button>
        </>
      )}
    </div>
  );

  const field = (
    <form onSubmit={handleSubmit}>
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          ref={inputRef}
          id="global-search"
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (trimmed) setOpen(true);
          }}
          placeholder="Search"
          className="w-full rounded-xl bg-zinc-100 py-2 pl-8 pr-12 text-[13px] text-zinc-800 placeholder:text-zinc-400 outline-none ring-0 transition-shadow focus:ring-2 focus:ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-zinc-700"
          autoComplete="off"
        />
        <kbd className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md bg-white px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 ring-1 ring-zinc-200/80 dark:bg-zinc-900 dark:ring-zinc-700">
          ⌘K
        </kbd>
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
            "flex h-9 w-9 items-center justify-center rounded-xl text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
            iconOpen && "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100",
          )}
        >
          <Search size={18} strokeWidth={1.75} />
        </button>
        {iconOpen && (
          <div className="absolute left-full top-0 z-50 ml-2 w-80 rounded-2xl bg-white p-2 shadow-[0_8px_30px_rgba(24,24,27,0.12)] ring-1 ring-zinc-200/80 dark:bg-zinc-900 dark:ring-zinc-800">
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
      {results}
    </div>
  );
}

function ResultGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <p className="px-3 py-1 text-[11px] text-zinc-400">{label}</p>
      {children}
    </div>
  );
}

function ResultLink({
  href,
  icon: Icon,
  title,
  hint,
  onPick,
}: {
  href: string;
  icon: typeof FolderKanban;
  title: string;
  hint: string;
  onPick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onPick}
      className="flex items-center gap-2 px-3 py-1.5 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
    >
      <Icon size={14} className="shrink-0 text-zinc-400" />
      <span className="min-w-0 flex-1 truncate">{title}</span>
      <span className="shrink-0 text-xs text-zinc-400">{hint}</span>
    </Link>
  );
}
