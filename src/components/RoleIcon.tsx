"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { KeyRound, Smile, Sparkles, User, ShieldCheck, type LucideIcon } from "lucide-react";
import { useCan } from "@/components/AuthProvider";
import { Loader } from "@/components/prompt-kit/loader";
import { cn } from "@/lib/cn";
import { useClickOutside } from "@/lib/useClickOutside";

type IconMap = Record<string, LucideIcon>;

// Every Lucide icon, loaded only when one is needed that isn't one of the built-ins below (it is a large chunk).
let allIcons: Promise<IconMap> | null = null;
function loadIcons(): Promise<IconMap> {
  allIcons ??= import("lucide-react").then((m) => m.icons as IconMap);
  return allIcons;
}

const BUILT_IN: IconMap = { ShieldCheck, User, KeyRound };

/** The icon a role gets when none was chosen: a shield for Admin, a person for Non-admin, a key for anything else. */
export function defaultRoleIcon(purpose: string): string {
  const key = purpose.trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (key === "admin" || key === "administrator") return "ShieldCheck";
  if (key === "non-admin" || key === "user" || key === "normal-user") return "User";
  return "KeyRound";
}

/** The full icon map, once loaded; only fetched when `needed`. */
function useIconMap(needed: boolean): IconMap | null {
  const [map, setMap] = useState<IconMap | null>(null);

  useEffect(() => {
    if (!needed) return;
    let cancelled = false;
    loadIcons().then((m) => {
      if (!cancelled) setMap(m);
    });
    return () => {
      cancelled = true;
    };
  }, [needed]);

  return map;
}

/** A role's icon, drawn without any background tile. */
export function RoleIcon({ icon, purpose, size = 18, className }: { icon: string | null; purpose: string; size?: number; className?: string }) {
  const name = icon ?? defaultRoleIcon(purpose);
  const map = useIconMap(!(name in BUILT_IN));
  const Icon = BUILT_IN[name] ?? map?.[name] ?? KeyRound;
  return <Icon size={size} className={className} />;
}

// What the picker offers before anything is typed.
const POPULAR = [
  "ShieldCheck", "Shield", "Crown", "UserCog", "User", "Users", "KeyRound", "Lock", "Eye", "Wrench", "Bug", "FlaskConical",
  "Briefcase", "Banknote", "Calculator", "GraduationCap", "Headset", "Truck", "HardHat", "Stethoscope", "Star", "Heart",
  "Rocket", "Settings", "BadgeCheck", "ClipboardCheck", "FileSearch", "Scale", "Building2", "Factory",
];

const SHOWN = 48;

/**
 * An icon button with no background. Hovering it (or tapping it) opens a small panel: search every icon, or ask AI for
 * suggestions that suit the role's name. Choosing one sets it and closes the panel.
 */
export function IconPicker({ value, roleText, onChange }: { value: string | null; roleText: string; onChange: (icon: string) => void }) {
  const canSuggest = useCan("ai_text_transform", "use");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [map, setMap] = useState<IconMap | null>(null);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);

  useClickOutside(wrapRef, () => setOpen(false), open);

  useEffect(() => {
    if (!open || map) return;
    let cancelled = false;
    loadIcons().then((m) => {
      if (!cancelled) setMap(m);
    });
    return () => {
      cancelled = true;
    };
  }, [open, map]);

  const results = useMemo(() => {
    if (!map) return [];
    const q = query.trim().toLowerCase().replace(/[\s-_]+/g, "");
    if (!q) return POPULAR.filter((n) => map[n]);
    return Object.keys(map)
      .filter((n) => n.toLowerCase().includes(q))
      .slice(0, SHOWN);
  }, [map, query]);

  function openNow() {
    window.clearTimeout(closeTimer.current);
    setOpen(true);
  }

  function closeSoon() {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 200);
  }

  function choose(name: string) {
    onChange(name);
    setOpen(false);
    setQuery("");
  }

  async function suggest() {
    if (!roleText.trim()) {
      setNote("Type the role name first.");
      return;
    }
    setSuggesting(true);
    setNote(null);
    try {
      const res = await fetch("/api/ai/transform-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "icons", text: roleText }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNote(body.error ?? "Could not get suggestions.");
        return;
      }
      const all = map ?? (await loadIcons());
      const names = String(body.text ?? "")
        .split(/[,\n]/)
        .map((n) => n.replace(/[^A-Za-z0-9]/g, ""))
        .filter((n, i, list) => all[n] && list.indexOf(n) === i)
        .slice(0, 8);
      setSuggested(names);
      if (names.length === 0) setNote("No suggestions this time. Try searching.");
    } catch {
      setNote("Network error. Try again.");
    } finally {
      setSuggesting(false);
    }
  }

  const grid = (names: string[]) => (
    <div className="grid grid-cols-8 gap-1">
      {names.map((n) => {
        const Icon = map?.[n];
        return Icon ? (
          <button
            key={n}
            type="button"
            title={n}
            aria-label={n}
            onClick={() => choose(n)}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
              value === n && "text-orange-600 dark:text-orange-400",
            )}
          >
            <Icon size={17} />
          </button>
        ) : null;
      })}
    </div>
  );

  const Current = value ? (map?.[value] ?? BUILT_IN[value]) : undefined;

  return (
    <div ref={wrapRef} className="relative" onMouseEnter={openNow} onMouseLeave={closeSoon}>
      <button
        type="button"
        aria-label="Choose an icon"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openNow())}
        className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:text-orange-600 dark:hover:text-orange-400"
      >
        {value ? <RoleIcon icon={value} purpose="" size={17} className="text-zinc-600 dark:text-zinc-300" /> : <Smile size={17} />}
        <span className="sr-only">{Current ? value : "No icon chosen"}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 w-80 max-w-[calc(100vw-2rem)] pt-2">
          <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  // Enter here picks the first match; it must not submit the surrounding form.
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    if (results[0]) choose(results[0]);
                  }
                }}
                placeholder="Search icons"
                className="field w-full py-1.5 text-xs"
              />
              {canSuggest && (
                <button
                  type="button"
                  onClick={() => void suggest()}
                  disabled={suggesting}
                  title="Suggest icons for this role with AI"
                  aria-label="Suggest icons with AI"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-orange-600 hover:bg-orange-50 disabled:cursor-wait dark:text-orange-400 dark:hover:bg-orange-500/10"
                >
                  {suggesting ? <Loader size={16} /> : <Sparkles size={16} />}
                </button>
              )}
            </div>

            {note && <p className="text-[11px] text-amber-600 dark:text-amber-400">{note}</p>}

            {!map ? (
              <div className="flex h-24 items-center justify-center text-zinc-400">
                <Loader size="md" />
              </div>
            ) : (
              <>
                {suggested.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Suggested</p>
                    {grid(suggested)}
                  </div>
                )}
                <div className="space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">{query.trim() ? "Results" : "Popular"}</p>
                  {results.length > 0 ? grid(results) : <p className="py-2 text-xs text-zinc-400">No icons match “{query}”.</p>}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
