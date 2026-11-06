"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarRange, Check, ChevronLeft, ChevronRight, ClipboardList, Clock, ListChecks, Pin, PinOff, Plus, Sparkles, WandSparkles, X } from "lucide-react";
import { EDITOR_HINT as HINT, RichTextEditor } from "@/components/ui/RichTextEditor";
import { MarkdownView } from "@/components/MarkdownView";
import { Button } from "@/components/ui/Button";
import { TextShimmer } from "@/components/prompt-kit/text-shimmer";
import { Loader } from "@/components/prompt-kit/loader";
import type { NoteAiAction } from "@/lib/ai/noteAi";
import { cn } from "@/lib/cn";
import { NoteHistory } from "@/components/NoteHistory";
import { dayLabel, monthCells, monthLabel, monthOf, shiftMonth, todayDay, weekKey } from "@/lib/dayDate";

type SaveState = "idle" | "saving" | "saved" | "error";
const WEEKDAY_HEADERS = ["S", "M", "T", "W", "T", "F", "S"];

type PageSummary = { id: string; key: string; title: string; position: number; pinned: boolean; empty: boolean };
type PinnedItem = { kind: "day"; day: string } | { kind: "page"; id: string; key: string; title: string };

const NOTE_AI: { action: NoteAiAction; label: string; icon: typeof Sparkles; heading: string }[] = [
  { action: "summarize", label: "Summarize", icon: Sparkles, heading: "Summary" },
  { action: "action-items", label: "Action items", icon: ListChecks, heading: "Action items" },
  { action: "key-points", label: "Key points", icon: ClipboardList, heading: "Key points" },
  { action: "cleanup", label: "Clean up", icon: WandSparkles, heading: "" },
];

/**
 * A month calendar backed by day-notes. `apiBase` is the scope's endpoint ("/api/me/day-notes" or
 * "/api/projects/<id>/day-notes"). Days with an entry get a dot; clicking a day opens its note in the rich editor.
 */
export function DayNoteCalendar({ apiBase, canEdit, canUseAi = false, projectId }: { apiBase: string; canEdit: boolean; canUseAi?: boolean; projectId?: string }) {
  // `today` is resolved on the client so the highlight matches the viewer's own date.
  const [today] = useState(() => todayDay());
  const [month, setMonth] = useState(() => monthOf(today));
  const [selected, setSelected] = useState(today);
  const [daysWithEntries, setDaysWithEntries] = useState<Set<string>>(new Set());
  const [content, setContent] = useState("");
  const [loadingDay, setLoadingDay] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [aiBusy, setAiBusy] = useState<NoteAiAction | null>(null);
  const [weekBusy, setWeekBusy] = useState(false);
  const [weekSummary, setWeekSummary] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  // Extra pages for the day or the week, pinned notes and the version history dialog.
  const [scopeMode, setScopeMode] = useState<"day" | "week">("day");
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [pageId, setPageId] = useState<string | null>(null);
  const [pinned, setPinned] = useState<PinnedItem[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const pageKey = scopeMode === "week" ? weekKey(selected) : selected;
  // Which note the editor is showing: the day's main note, or one of its (or the week's) pages.
  const noTarget = scopeMode === "week" && pageId === null;
  const target = pageId ? { url: `${apiBase}/pages/${pageId}`, noteKey: `page:${pageId}` } : { url: `${apiBase}/${selected}`, noteKey: selected };

  const savedContent = useRef("");
  const timer = useRef<number | undefined>(undefined);

  // Which days in the shown month already have an entry.
  useEffect(() => {
    let cancelled = false;
    fetch(`${apiBase}?month=${month}`)
      .then((r) => (r.ok ? r.json() : { days: [] }))
      .then((body) => {
        if (!cancelled) setDaysWithEntries(new Set(Array.isArray(body.days) ? body.days : []));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [apiBase, month]);

  // The selected day's note.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingDay(true);
      setSaveState("idle");
      if (noTarget) {
        savedContent.current = "";
        setContent("");
        setLoadingDay(false);
        return;
      }
      try {
        const res = await fetch(target.url);
        const body = res.ok ? await res.json() : { note: { content: "" } };
        if (cancelled) return;
        const text = body.page?.content ?? body.note?.content ?? "";
        savedContent.current = text;
        setContent(text);
      } catch {
        // leave the current content on a transient failure
      } finally {
        if (!cancelled) setLoadingDay(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [target.url, noTarget]);

  const save = useCallback(
    async (next: string) => {
      if (next === savedContent.current) return;
      const day = selected;
      const url = target.url;
      const isPage = pageId !== null;
      setSaveState("saving");
      try {
        const res = await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: next }),
        });
        if (!res.ok) {
          setSaveState("error");
          return;
        }
        savedContent.current = next;
        setSaveState("saved");
        if (!isPage) {
          setDaysWithEntries((prev) => {
            const copy = new Set(prev);
            if (next.trim()) copy.add(day);
            else copy.delete(day);
            return copy;
          });
        }
      } catch {
        setSaveState("error");
      }
    },
    [selected, target.url, pageId],
  );

  // Autosave ~1.2s after typing stops.
  useEffect(() => {
    if (!canEdit || loadingDay || noTarget || content === savedContent.current) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void save(content), 1200);
    return () => window.clearTimeout(timer.current);
  }, [content, canEdit, loadingDay, noTarget, save]);

  function selectDay(day: string) {
    // Save anything pending on the current day before switching.
    if (canEdit && !noTarget && content !== savedContent.current) void save(content);
    setPageId(null);
    setSelected(day);
    if (monthOf(day) !== month) setMonth(monthOf(day));
  }

  async function runNoteTool(action: NoteAiAction) {
    if (aiBusy) return;
    if (!content.trim()) {
      setAiError("Write something for this day first, then let AI help.");
      return;
    }
    setAiBusy(action);
    setAiError(null);
    try {
      const res = await fetch("/api/ai/note-tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, text: content }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAiError(body.error ?? "The AI tool is unavailable right now.");
        return;
      }
      const result: string = body.text ?? "";
      const heading = NOTE_AI.find((a) => a.action === action)?.heading;
      setContent((prev) => (action === "cleanup" ? result : `${prev.trimEnd()}\n\n## ${heading}\n\n${result}\n`));
    } catch {
      setAiError("Network error — please try again.");
    } finally {
      setAiBusy(null);
    }
  }

  async function thisWeek() {
    if (weekBusy) return;
    setWeekBusy(true);
    setAiError(null);
    setWeekSummary(null);
    try {
      const res = await fetch(`${apiBase}/week-summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endDay: selected }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAiError(body.error ?? "Could not write the weekly summary.");
        return;
      }
      setWeekSummary(body.summary ?? "");
    } catch {
      setAiError("Network error — please try again.");
    } finally {
      setWeekBusy(false);
    }
  }

  // The pages for this day or week.
  useEffect(() => {
    let cancelled = false;
    fetch(`${apiBase}/pages?key=${encodeURIComponent(pageKey)}`)
      .then((r) => (r.ok ? r.json() : { pages: [] }))
      .then((body) => {
        if (cancelled) return;
        const list: PageSummary[] = body.pages ?? [];
        setPages(list);
        // A week always shows one of its pages; a day shows its main note unless a page is open.
        setPageId((prev) => (prev && list.some((p) => p.id === prev) ? prev : scopeMode === "week" ? (list[0]?.id ?? null) : null));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [apiBase, pageKey, scopeMode]);

  const loadPinned = useCallback(() => {
    fetch(`${apiBase}/pinned`)
      .then((r) => (r.ok ? r.json() : { pinned: [] }))
      .then((body) => setPinned(body.pinned ?? []))
      .catch(() => {});
  }, [apiBase]);
  useEffect(() => {
    loadPinned();
  }, [loadPinned]);

  const isPinned = pageId ? pinned.some((p) => p.kind === "page" && p.id === pageId) : pinned.some((p) => p.kind === "day" && p.day === selected);

  async function addPage() {
    const title = window.prompt("Name this page (you can leave it empty)", "");
    if (title === null) return;
    if (canEdit && !noTarget && content !== savedContent.current) await save(content);
    const res = await fetch(`${apiBase}/pages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: pageKey, title }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setAiError(body.error ?? "Could not add the page.");
      return;
    }
    setPages((prev) => [...prev, body.page]);
    setPageId(body.page.id);
  }

  async function renamePage(page: PageSummary) {
    const title = window.prompt("Page name", page.title);
    if (title === null) return;
    const res = await fetch(`${apiBase}/pages/${page.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
    if (res.ok) setPages((prev) => prev.map((p) => (p.id === page.id ? { ...p, title: title.trim() } : p)));
  }

  async function removePage(page: PageSummary) {
    if (!window.confirm(`Delete ${page.title || "this page"}? This cannot be undone.`)) return;
    const res = await fetch(`${apiBase}/pages/${page.id}`, { method: "DELETE" });
    if (!res.ok) return;
    const rest = pages.filter((p) => p.id !== page.id);
    setPages(rest);
    if (pageId === page.id) setPageId(scopeMode === "week" ? (rest[0]?.id ?? null) : null);
    loadPinned();
  }

  async function togglePin() {
    const next = !isPinned;
    const res = pageId
      ? await fetch(`${apiBase}/pages/${pageId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pinned: next }) })
      : await fetch(`${apiBase}/pinned`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ day: selected, pinned: next }) });
    if (res.ok) loadPinned();
  }

  function openPinned(item: PinnedItem) {
    if (item.kind === "day") {
      setScopeMode("day");
      selectDay(item.day);
      return;
    }
    const weekly = item.key.startsWith("week:");
    setScopeMode(weekly ? "week" : "day");
    selectDay(weekly ? item.key.slice(5) : item.key);
    setPageId(item.id);
  }

  const cells = monthCells(month);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
      {/* Calendar */}
      <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between px-1 py-1">
          <button type="button" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))} className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{monthLabel(month)}</span>
          <button type="button" aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))} className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="mt-1 grid grid-cols-7 gap-0.5 text-center text-[11px] font-medium text-zinc-400">
          {WEEKDAY_HEADERS.map((d, i) => (
            <span key={i} className="py-1">
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((cell) => {
            const isSelected = cell.day === selected;
            const isToday = cell.day === today;
            const hasEntry = daysWithEntries.has(cell.day);
            const num = Number(cell.day.slice(8));
            return (
              <button
                key={cell.day}
                type="button"
                onClick={() => selectDay(cell.day)}
                aria-current={isToday ? "date" : undefined}
                aria-pressed={isSelected}
                className={cn(
                  "relative flex h-9 items-center justify-center rounded-lg text-sm transition-colors",
                  !cell.inMonth && "text-zinc-300 dark:text-zinc-600",
                  cell.inMonth && !isSelected && "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800",
                  isSelected && "bg-orange-600 font-semibold text-white",
                  !isSelected && isToday && "ring-1 ring-inset ring-orange-400",
                )}
              >
                {num}
                {hasEntry && <span className={cn("absolute bottom-1 h-1 w-1 rounded-full", isSelected ? "bg-white" : "bg-orange-500")} />}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => selectDay(today)} disabled={selected === today}>
            Today
          </Button>
          {canUseAi && (
            <Button variant="secondary" size="sm" icon={weekBusy ? undefined : CalendarRange} loading={weekBusy} onClick={() => void thisWeek()} title="AI summary of the last 7 days up to the selected day">
              This week
            </Button>
          )}
        </div>
        {pinned.length > 0 && (
          <div className="mt-3 border-t border-zinc-100 pt-2 dark:border-zinc-800">
            <p className="mb-1 flex items-center gap-1.5 px-1 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
              <Pin size={11} /> Pinned
            </p>
            {pinned.map((item) => (
              <button
                key={item.kind === "day" ? `d-${item.day}` : `p-${item.id}`}
                type="button"
                onClick={() => openPinned(item)}
                className="block w-full truncate rounded-md px-2 py-1 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {item.kind === "day" ? dayLabel(item.day) : `${item.title || "Untitled page"} \u00b7 ${item.key.startsWith("week:") ? "week of " + dayLabel(item.key.slice(5)) : dayLabel(item.key)}`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected day */}
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100" suppressHydrationWarning>
            {dayLabel(selected)}
            {selected === today && <span className="ml-2 rounded-full bg-orange-50 px-1.5 py-0.5 text-xs font-medium text-orange-600 dark:bg-orange-500/10 dark:text-orange-400">Today</span>}
          </h2>
          <span className="flex items-center gap-1.5 text-xs text-zinc-400">
            {canEdit && (
              <button
                type="button"
                onClick={() => void togglePin()}
                disabled={noTarget}
                aria-pressed={isPinned}
                title={isPinned ? "Unpin this note" : "Pin this note"}
                className={cn("flex h-7 w-7 items-center justify-center rounded-md hover:bg-zinc-100 disabled:opacity-40 dark:hover:bg-zinc-800", isPinned ? "text-orange-500" : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200")}
              >
                {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
              </button>
            )}
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              disabled={noTarget}
              title="Version history"
              className="flex h-7 items-center gap-1 rounded-md px-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              <Clock size={14} /> History
            </button>
            <span className="flex items-center gap-1.5" aria-live="polite">
            {saveState === "saving" && <TextShimmer className="text-xs">Saving…</TextShimmer>}
            {saveState === "saved" && (
              <>
                <Check size={13} className="text-green-600 dark:text-green-400" /> Saved
              </>
            )}
            {saveState === "error" && <span className="text-red-600 dark:text-red-400">Couldn&apos;t save</span>}
            </span>
          </span>
        </div>

        {/* Pages: the day's main note and its extra pages, or the week's pages */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex rounded-lg bg-zinc-100 p-0.5 text-xs font-medium dark:bg-zinc-800" role="group" aria-label="Pages for">
            {(["day", "week"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={scopeMode === m}
                onClick={() => {
                  if (canEdit && !noTarget && content !== savedContent.current) void save(content);
                  setPageId(null);
                  setScopeMode(m);
                }}
                className={cn("rounded-md px-2.5 py-1 transition-colors", scopeMode === m ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200")}
              >
                {m === "day" ? "Day" : "Week"}
              </button>
            ))}
          </div>
          {scopeMode === "day" && (
            <button
              type="button"
              onClick={() => {
                if (canEdit && !noTarget && content !== savedContent.current) void save(content);
                setPageId(null);
              }}
              className={cn("rounded-lg px-2.5 py-1 text-xs font-medium", pageId === null ? "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400" : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800")}
            >
              Note
            </button>
          )}
          {pages.map((page, i) => (
            <span key={page.id} className={cn("group inline-flex items-center rounded-lg text-xs font-medium", pageId === page.id ? "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400" : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800")}>
              <button
                type="button"
                onClick={() => {
                  if (canEdit && !noTarget && content !== savedContent.current) void save(content);
                  setPageId(page.id);
                }}
                onDoubleClick={() => canEdit && void renamePage(page)}
                title={canEdit ? "Double-click to rename" : undefined}
                className="max-w-[10rem] truncate px-2.5 py-1"
              >
                {page.title || `Page ${i + 1}`}
              </button>
              {canEdit && pageId === page.id && (
                <button type="button" onClick={() => void removePage(page)} aria-label="Delete this page" className="mr-1 rounded p-0.5 text-zinc-400 hover:text-red-500">
                  <X size={12} />
                </button>
              )}
            </span>
          ))}
          {canEdit && (
            <button type="button" onClick={() => void addPage()} title={scopeMode === "week" ? "Add a page for this week" : "Add a page to this day"} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
              <Plus size={13} /> Page
            </button>
          )}
        </div>

        {canUseAi && canEdit && (
          <div className="flex flex-wrap items-center gap-1.5">
            {NOTE_AI.map(({ action, label, icon: Icon }) => (
              <button
                key={action}
                type="button"
                onClick={() => void runNoteTool(action)}
                disabled={aiBusy !== null}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-orange-300 hover:text-orange-600 disabled:cursor-wait disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-orange-500/50 dark:hover:text-orange-400"
              >
                {aiBusy === action ? <Loader size={13} /> : <Icon size={13} className="text-orange-500" />}
                {label}
              </button>
            ))}
          </div>
        )}

        {(aiBusy || weekBusy) && (
          <div className="flex items-center gap-2 rounded-lg bg-orange-50/60 px-3 py-2 text-sm dark:bg-orange-500/5" aria-live="polite">
            <Loader size="sm" className="text-orange-500" />
            <TextShimmer className="text-sm">{weekBusy ? "Reading the week\u2019s notes\u2026" : "Working on your notes\u2026"}</TextShimmer>
          </div>
        )}
        {aiError && <p className="text-sm text-amber-600 dark:text-amber-400">{aiError}</p>}

        {weekSummary && !weekBusy && (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-zinc-400">
                <CalendarRange size={13} /> This week
              </p>
              <button type="button" aria-label="Dismiss" onClick={() => setWeekSummary(null)} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                <X size={14} />
              </button>
            </div>
            <MarkdownView content={weekSummary} />
          </div>
        )}

        {noTarget ? (
          <p className="rounded-md border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-400 dark:border-zinc-700">
            {canEdit ? "This week has no pages yet. Use + Page to start one." : "No pages for this week."}
          </p>
        ) : loadingDay ? (
          <div className="flex h-72 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800">
            <TextShimmer className="text-sm">Loading…</TextShimmer>
          </div>
        ) : canEdit ? (
          <RichTextEditor
            key={`${selected}-${pageId ?? "main"}`}
            value={content}
            onChange={setContent}
            projectId={projectId}
            placeholder={`What did you work on? ${HINT}`}
            className="min-h-[18rem]"
          />
        ) : content.trim() ? (
          <div className="rounded-xl border border-zinc-200 bg-white px-5 py-5 dark:border-zinc-800 dark:bg-zinc-900">
            <MarkdownView content={content} />
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-400 dark:border-zinc-700">No note for this day.</p>
        )}
        {canEdit && <p className="text-xs text-zinc-400">Notes save automatically. Use the toolbar for formatting and AI.</p>}
        {historyOpen && <NoteHistory apiBase={apiBase} noteKey={target.noteKey} canRestore={canEdit} onRestore={(restored) => setContent(restored)} onClose={() => setHistoryOpen(false)} />}
      </div>
    </div>
  );
}
