"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronLeft,
  FolderKanban,
  LayoutGrid,
  Lightbulb,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { GlobalSearch } from "@/components/GlobalSearch";
import { cn } from "@/lib/cn";

const NAV_LINKS = [
  { href: "/", label: "Dashboard", icon: LayoutGrid, shortcut: "1" },
  { href: "/projects", label: "Projects", icon: FolderKanban, shortcut: "2" },
  { href: "/ideas", label: "Ideas", icon: Lightbulb, shortcut: "3" },
  { href: "/insights", label: "Insights", icon: Sparkles, shortcut: "4" },
] as const;

function BrandMark({ size }: { size: "sm" | "md" | "lg" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block shrink-0 rounded-full bg-orange-600 shadow-[inset_0_1px_1px_rgba(255,255,255,0.28)]",
        size === "sm" && "h-7 w-7",
        size === "md" && "h-8 w-8",
        size === "lg" && "h-9 w-9",
      )}
    />
  );
}

function SearchFallback({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return <div className="mx-auto h-9 w-9 rounded-xl bg-zinc-100 dark:bg-zinc-800" />;
  }
  return <div className="h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800" />;
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "group relative flex items-center rounded-xl text-[13px] font-medium transition-colors",
        collapsed ? "h-9 w-9 justify-center" : "h-9 gap-2.5 px-2.5",
        active
          ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
          : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-100",
      )}
    >
      <Icon size={18} strokeWidth={1.75} className="shrink-0" />
      {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
      {collapsed && (
        <span className="pointer-events-none absolute left-full z-50 ml-2 hidden whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white shadow-sm group-hover:block dark:bg-zinc-100 dark:text-zinc-900">
          {label}
        </span>
      )}
    </Link>
  );
}

export function Sidebar({
  collapsed,
  onToggle,
  onNavigate,
  className,
}: {
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
      const match = NAV_LINKS.find((link) => link.shortcut === e.key);
      if (!match) return;
      e.preventDefault();
      router.push(match.href);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col rounded-xl bg-white shadow-[0_1px_2px_rgba(24,24,27,0.04),0_12px_32px_rgba(24,24,27,0.06)] ring-1 ring-zinc-950/5 transition-[width] duration-200 ease-out dark:bg-zinc-900 dark:ring-white/10",
        collapsed ? "w-[68px]" : "w-[252px]",
        className,
      )}
    >
      <div className={cn("flex items-center", collapsed ? "justify-center px-2 pt-3" : "gap-2 px-3 pt-3")}>
        {collapsed ? (
          <button
            type="button"
            onClick={onToggle}
            title="Expand sidebar"
            aria-label="Expand sidebar"
            className="flex h-9 w-9 items-center justify-center rounded-full transition-opacity hover:opacity-90"
          >
            <BrandMark size="lg" />
          </button>
        ) : (
          <>
            <Link href="/" onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-0.5 py-1">
              <BrandMark size="md" />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold leading-tight text-zinc-900 dark:text-zinc-50">
                  AIML
                </span>
                <span className="block truncate text-[11px] leading-tight text-zinc-400">Project Directory</span>
              </span>
            </Link>
            <button
              type="button"
              onClick={onToggle}
              aria-label="Collapse sidebar"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-300 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              <ChevronLeft size={16} strokeWidth={1.75} />
            </button>
          </>
        )}
      </div>

      <div className={cn("mt-3", collapsed ? "px-2" : "px-3")}>
        <Suspense fallback={<SearchFallback collapsed={collapsed} />}>
          <GlobalSearch variant={collapsed ? "icon" : "compact"} />
        </Suspense>
      </div>

      <nav className={cn("mt-3 flex flex-1 flex-col gap-0.5", collapsed ? "items-center px-2" : "px-3")}>
        {NAV_LINKS.map((link) => (
          <NavItem
            key={link.href}
            href={link.href}
            label={link.label}
            icon={link.icon}
            collapsed={collapsed}
            onNavigate={onNavigate}
            active={link.href === "/" ? pathname === "/" : pathname.startsWith(link.href)}
          />
        ))}

        <div className="flex-1" />

        <NavItem
          href="/settings"
          label="Settings"
          icon={Settings}
          collapsed={collapsed}
          onNavigate={onNavigate}
          active={pathname === "/settings"}
        />
      </nav>

      <div className={cn("pb-3 pt-1", collapsed ? "flex justify-center px-2" : "px-3")}>
        {collapsed ? (
          <Link
            href="/settings"
            title="Local workspace"
            onClick={onNavigate}
            className="group relative flex h-9 w-9 items-center justify-center rounded-full bg-orange-50 text-[11px] font-semibold text-orange-700 ring-1 ring-orange-100 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-500/20"
          >
            E
            <span className="pointer-events-none absolute left-full z-50 ml-2 hidden whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white shadow-sm group-hover:block dark:bg-zinc-100 dark:text-zinc-900">
              Local workspace
            </span>
          </Link>
        ) : (
          <Link
            href="/settings"
            onClick={onNavigate}
            className="flex items-center gap-2.5 rounded-xl px-1.5 py-1.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-50 text-[11px] font-semibold text-orange-700 ring-1 ring-orange-100 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-500/20">
              E
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium leading-tight text-zinc-800 dark:text-zinc-100">
                AIML Directory
              </span>
              <span className="block truncate text-[11px] leading-tight text-zinc-400">Local workspace</span>
            </span>
          </Link>
        )}
      </div>
    </aside>
  );
}
