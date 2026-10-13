"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  House,
  LogOut,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { BrandName, BrandTagline } from "@/components/BrandingProvider";
import { GlowBulbIcon } from "@/components/icons/GlowBulbIcon";
import { ChatbotLaunchButton } from "@/components/ChatbotLaunchButton";
import { ProfileMenu } from "@/components/ProfileMenu";
import { GlobalSearch } from "@/components/GlobalSearch";
import { LinkPendingHint } from "@/components/LinkPendingHint";
import { can, scopeFor, type Role } from "@/lib/auth/permissions";
import type { AuthUser } from "@/lib/auth/types";
import { cn } from "@/lib/cn";
import { CHAT_HISTORY_KEY } from "@/lib/chatHistory";
import { RESET_REQUESTS_CHANGED } from "@/lib/resetRequestEvents";
import { Avatar } from "@/components/Avatar";

// Lucide icons and our own (GlowBulbIcon) share this shape.
type NavIcon = React.ElementType<{
  size?: number;
  strokeWidth?: number;
  className?: string;
}>;

const NAV_LINKS = [
  { href: "/", label: "Dashboard", icon: House, shortcut: "1", resource: null },
  {
    href: "/projects",
    label: "Projects",
    icon: FolderOpen,
    shortcut: "2",
    resource: "projects",
  },
  {
    href: "/ideas",
    label: "Ideas",
    icon: GlowBulbIcon,
    shortcut: "3",
    resource: "ideas",
  },
  // Insights summarise the whole directory, so they need full (not "own") view access.
  {
    href: "/insights",
    label: "Insights",
    icon: Sparkles,
    shortcut: "4",
    resource: "insights",
  },
] as const;

function canSeeLink(user: AuthUser, link: (typeof NAV_LINKS)[number]): boolean {
  if (link.resource === null) return true;
  const scope = scopeFor(user.permissions, link.resource, "view");
  return link.resource === "insights" ? scope === "ALL" : scope !== "NONE";
}

function BrandMark() {
  return <BrandLogo size={34} priority />;
}

function SearchFallback({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return (
      <div className="mx-auto h-9 w-9 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
    );
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
  badge = 0,
}: {
  href: string;
  label: string;
  icon: NavIcon;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
  /** Small count bubble, e.g. open password-reset requests. Hidden at 0. */
  badge?: number;
}) {
  return (
    <Link
      href={href}
      prefetch
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "group relative flex items-center rounded-xl text-[13px] font-medium transition-colors",
        collapsed ? "h-10 w-10 justify-center" : "h-10 gap-3 px-2.5",
        active
          ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
          : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-100",
      )}
    >
      <Icon size={21} strokeWidth={1.75} className="shrink-0" />
      {badge > 0 && (
        <span
          className={cn(
            "flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-600 px-1 text-[10px] font-semibold leading-none text-white",
            collapsed ? "absolute right-0.5 top-0.5" : "order-last",
          )}
        >
          {badge > 9 ? "9+" : badge}
        </span>
      )}
      {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
      {!collapsed && <LinkPendingHint />}
      {collapsed && (
        <span className="pointer-events-none absolute left-full z-50 ml-2 hidden whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white shadow-sm group-hover:block dark:bg-zinc-100 dark:text-zinc-900">
          {label}
        </span>
      )}
    </Link>
  );
}

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  MEMBER: "Member",
  VIEWER: "Viewer",
};

export function Sidebar({
  user,
  collapsed,
  onToggle,
  onNavigate,
  className,
}: {
  user: AuthUser;
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const visibleLinks = NAV_LINKS.filter((link) => canSeeLink(user, link));
  const canSearch = can(user.permissions, "search", "view");
  const canChat = can(user.permissions, "ai_chatbot", "use");
  const canAdmin = can(user.permissions, "users", "view");
  const canResolveResets = can(user.permissions, "users", "edit");
  const [resetCount, setResetCount] = useState(0);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    // Chat history is stored in this browser; don't leave one user's conversations for the next.
    try {
      window.localStorage.removeItem(CHAT_HISTORY_KEY);
    } catch {
      // storage unavailable — nothing to clear
    }
    router.replace("/login");
    router.refresh();
  }

  // Open "forgot password" requests, shown as a bubble on Users. Refreshes on navigation, so resolving one clears it.
  useEffect(() => {
    if (!canResolveResets) return;
    let cancelled = false;
    function load() {
      fetch("/api/admin/reset-requests")
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { requests?: unknown[] } | null) => {
          if (!cancelled) setResetCount(data?.requests?.length ?? 0);
        })
        .catch(() => {});
    }
    load();
    window.addEventListener(RESET_REQUESTS_CHANGED, load);
    return () => {
      cancelled = true;
      window.removeEventListener(RESET_REQUESTS_CHANGED, load);
    };
  }, [canResolveResets, pathname]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]"))
        return;
      const match = visibleLinks.find((link) => link.shortcut === e.key);
      if (!match) return;
      e.preventDefault();
      router.push(match.href);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, visibleLinks]);

  return (
    <aside
      className={cn(
        "relative flex h-full shrink-0 flex-col rounded-xl bg-white shadow-[0_1px_2px_rgba(24,24,27,0.04),0_12px_32px_rgba(24,24,27,0.06)] ring-1 ring-zinc-950/5 transition-[width] duration-200 ease-out dark:bg-zinc-900 dark:ring-white/10",
        collapsed ? "w-[68px]" : "w-[252px]",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center",
          collapsed ? "justify-center px-2 pt-3" : "gap-2 px-3 pt-3",
        )}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={onToggle}
            title="Expand sidebar"
            aria-label="Expand sidebar"
            className="group relative flex h-10 w-10 items-center justify-center rounded-lg outline-none transition-colors hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:hover:bg-zinc-800 dark:focus-visible:ring-offset-zinc-900"
          >
            {/* The logo; on hover or keyboard focus it turns into an arrow so it reads as "expand". */}
            <BrandLogo
              size={30}
              className="transition-opacity group-hover:opacity-0 group-focus-visible:opacity-0"
            />
            <ChevronRight
              size={22}
              strokeWidth={2.5}
              className="absolute text-orange-600 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
            />
          </button>
        ) : (
          <>
            <Link
              href="/"
              onClick={onNavigate}
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-0.5 py-1"
            >
              <BrandMark />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold leading-tight text-zinc-900 dark:text-zinc-50">
                  <BrandName />
                </span>
                <span className="block truncate text-[11px] leading-tight text-zinc-400">
                  <BrandTagline />
                </span>
              </span>
            </Link>
            <button
              type="button"
              onClick={onToggle}
              aria-label="Collapse sidebar"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-300 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              <ChevronLeft size={18} strokeWidth={1.75} />
            </button>
          </>
        )}
      </div>

      {canSearch && (
        <div className={cn("mt-3", collapsed ? "px-2" : "px-3")}>
          <Suspense fallback={<SearchFallback collapsed={collapsed} />}>
            <GlobalSearch variant={collapsed ? "icon" : "compact"} />
          </Suspense>
        </div>
      )}

      <nav
        className={cn(
          "mt-3 flex flex-1 flex-col gap-0.5",
          collapsed ? "items-center px-2" : "px-3",
        )}
      >
        {visibleLinks.map((link) => (
          <NavItem
            key={link.href}
            href={link.href}
            label={link.label}
            icon={link.icon}
            collapsed={collapsed}
            onNavigate={onNavigate}
            active={
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href)
            }
          />
        ))}

        {canAdmin && (
          <>
            {!collapsed && (
              <span className="mb-0.5 mt-3 px-2.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                Admin
              </span>
            )}
            {collapsed && (
              <div className="my-2 h-px w-6 bg-zinc-200 dark:bg-zinc-800" />
            )}
            <NavItem
              href="/admin/users"
              label="Users"
              icon={Users}
              badge={resetCount}
              collapsed={collapsed}
              onNavigate={onNavigate}
              active={pathname.startsWith("/admin/users")}
            />
            <NavItem
              href="/admin/permissions"
              label="Permissions"
              icon={ShieldCheck}
              collapsed={collapsed}
              onNavigate={onNavigate}
              active={pathname.startsWith("/admin/permissions")}
            />
          </>
        )}

        <div className="flex-1" />

        {canChat && (
          <div
            className={cn("mb-2", collapsed ? "flex justify-center" : "px-0.5")}
          >
            <ChatbotLaunchButton collapsed={collapsed} />
          </div>
        )}

        {!collapsed && (
          <NavItem
            href="/settings"
            label="Settings"
            icon={Settings}
            collapsed={collapsed}
            onNavigate={onNavigate}
            active={pathname === "/settings"}
          />
        )}
      </nav>

      <div
        className={cn(
          "shrink-0",
          collapsed
            ? "flex flex-col items-center gap-3 px-2 pb-4 pt-2"
            : "px-3 pb-3 pt-2",
        )}
      >
        {collapsed ? (
          <>
            {/* A short rule sets the person apart from the navigation and the assistant above. */}
            <span
              aria-hidden
              className="h-px w-6 bg-zinc-200 dark:bg-zinc-800"
            />
            <ProfileMenu
              user={user}
              onNavigate={onNavigate}
              onSignOut={signOut}
            />
          </>
        ) : (
          <div className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50/70 p-1.5 dark:border-zinc-800 dark:bg-zinc-800/30">
            <Link
              href="/settings"
              onClick={onNavigate}
              title="Your profile and settings"
              className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1.5 py-1 transition-colors hover:bg-white dark:hover:bg-zinc-800"
            >
              <Avatar
                user={user}
                size={38}
                className="ring-2 ring-white dark:ring-zinc-900"
              />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold leading-tight text-zinc-900 dark:text-zinc-50">
                  {user.name}
                </span>
                <span className="mt-1 inline-flex items-center rounded-full bg-orange-50 px-1.5 py-px text-[10px] font-semibold leading-4 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
                  {ROLE_LABELS[user.role]}
                </span>
              </span>
            </Link>
            <button
              type="button"
              onClick={signOut}
              title="Sign out"
              aria-label="Sign out"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white hover:text-red-600 dark:hover:bg-zinc-800 dark:hover:text-red-400"
            >
              <LogOut size={17} strokeWidth={1.75} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
