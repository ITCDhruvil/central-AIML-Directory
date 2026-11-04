"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, ExternalLink, Pencil, ShieldAlert, Trash2 } from "lucide-react";
import { EnvIcon, STATUS_DOT, STATUS_LABEL, STATUS_STYLE } from "@/components/ProjectEnvironments";
import type { EnvironmentStatus } from "@/lib/environments/validate";
import { useCan } from "@/components/AuthProvider";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FLUID_TAB_ITEM } from "@/components/ui/FluidTabs";
import { cn } from "@/lib/cn";
import { useClickOutside } from "@/lib/useClickOutside";
import { isInternalDeploymentUrl, INTERNAL_ACCESS_HINT } from "@/lib/deploymentLabel";

function ActionItem({
  icon,
  label,
  href,
  external,
  onClick,
  title,
  tone = "neutral",
}: {
  icon: ReactNode;
  label: string;
  href?: string;
  external?: boolean;
  onClick?: () => void;
  title?: string;
  tone?: "neutral" | "accent" | "danger";
}) {
  const toneClass =
    tone === "accent"
      ? "font-semibold text-orange-600 dark:text-orange-400"
      : tone === "danger"
        ? "font-semibold text-red-600 dark:text-red-400"
        : "font-semibold text-[#585652] group-hover:dark:text-neutral-300 dark:text-neutral-500";

  const inner = (
    <>
      <span className="absolute inset-0 rounded-full border border-[#fefefe]/90 bg-gradient-to-b from-[#fefefe] to-gray-50/80 opacity-0 shadow-xs transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 dark:border-neutral-600/50 dark:from-neutral-700 dark:to-neutral-800/90" />
      <span className={cn("relative z-10 flex items-center gap-1.5 sm:gap-3", toneClass)}>
        <span className="flex shrink-0 items-center justify-center">{icon}</span>
        <span className="text-sm tracking-tight whitespace-nowrap sm:text-base">{label}</span>
      </span>
    </>
  );

  const className = FLUID_TAB_ITEM;

  if (href && external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" title={title} className={className}>
        {inner}
      </a>
    );
  }

  if (href) {
    return (
      <Link href={href} title={title} className={className}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} title={title} className={className}>
      {inner}
    </button>
  );
}

export type VisitTarget = { id: string; name: string; url: string | null; status: string; isProduction: boolean };

function hostAndPath(url: string): string {
  try {
    const u = new URL(url);
    return u.host + (u.pathname === "/" ? "" : u.pathname.replace(/\/$/, ""));
  } catch {
    return url;
  }
}

/**
 * "Visit" with several environments: hovering (or tapping) it shows a small panel of them right under the button.
 * The panel uses fixed coordinates because the tab bar around this button scrolls horizontally and would clip it.
 * Environments without an app URL are listed too, greyed out, so nothing seems to be missing.
 */
function VisitMenu({ targets }: { targets: VisitTarget[] }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);

  useClickOutside(wrapRef, () => setOpen(false), open);

  // The panel is positioned from where the button was when it opened, so close it if the page moves under it.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  function show() {
    window.clearTimeout(closeTimer.current);
    const rect = wrapRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom, right: Math.max(8, window.innerWidth - rect.right) });
    setOpen(true);
  }

  function hideSoon() {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 150);
  }

  const available = targets.filter((t) => t.url).length;

  return (
    <div ref={wrapRef} onMouseEnter={show} onMouseLeave={hideSoon} className="flex">
      <ActionItem icon={<ExternalLink size={18} />} label="Visit" tone="accent" onClick={() => (open ? setOpen(false) : show())} />
      {open && (
        <div style={{ top: pos.top, right: pos.right }} className="fixed z-50 pt-2" role="menu" aria-label="Visit an environment">
          <div className="w-80 max-w-[calc(100vw-1rem)] overflow-hidden rounded-2xl border border-zinc-200 bg-white p-2 shadow-xl shadow-black/10 dark:border-zinc-700/70 dark:bg-zinc-900 dark:shadow-black/40">
            <div className="flex items-center justify-between px-2.5 pb-2 pt-1.5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Visit an environment</p>
              <span className="text-[11px] text-zinc-400">
                {available} of {targets.length}
              </span>
            </div>
            <div className="space-y-0.5">
              {targets.map((t) => {
                const status = (t.status in STATUS_LABEL ? t.status : "UNKNOWN") as EnvironmentStatus;
                const body = (
                  <>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      <EnvIcon name={t.name} size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{t.name}</span>
                        {t.isProduction && <ShieldAlert size={12} className="shrink-0 text-amber-500" aria-label="Production" />}
                      </span>
                      <span className="block truncate text-xs text-zinc-400">{t.url ? hostAndPath(t.url) : "No app URL yet"}</span>
                    </span>
                    <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_STYLE[status])}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[status])} />
                      {STATUS_LABEL[status]}
                    </span>
                    {t.url && <ArrowUpRight size={15} className="shrink-0 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-orange-500" />}
                  </>
                );
                return t.url ? (
                  <a
                    key={t.id}
                    href={t.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className="group flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-zinc-100 focus-visible:bg-zinc-100 focus-visible:outline-none dark:hover:bg-zinc-800 dark:focus-visible:bg-zinc-800"
                  >
                    {body}
                  </a>
                ) : (
                  <div key={t.id} role="menuitem" aria-disabled="true" className="flex cursor-not-allowed items-center gap-3 rounded-xl px-2.5 py-2 opacity-50">
                    {body}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ProjectActions({
  id,
  name,
  deploymentUrl,
  environments = [],
}: {
  id: string;
  name: string;
  deploymentUrl?: string | null;
  /** All of the project's environments. Two or more turn Visit into a hover menu; a single one with a URL opens directly. */
  environments?: VisitTarget[];
}) {
  const router = useRouter();
  const canEdit = useCan("projects", "edit");
  const canDelete = useCan("projects", "delete");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Failed to delete project");
        setDeleting(false);
        setConfirmOpen(false);
        return;
      }
      router.push("/projects");
      router.refresh();
    } catch {
      setError("Network error — please try again");
      setDeleting(false);
      setConfirmOpen(false);
    }
  }

  return (
    <>
      {environments.length > 1 ? (
        <VisitMenu targets={environments} />
      ) : environments.length === 1 && environments[0].url ? (
        <ActionItem href={environments[0].url} external icon={<ExternalLink size={18} />} label="Visit" tone="accent" title={`Open ${environments[0].name}`} />
      ) : (
        deploymentUrl && (
          <ActionItem
            href={deploymentUrl}
            external
            icon={<ExternalLink size={18} />}
            label="Visit"
            tone="accent"
            title={isInternalDeploymentUrl(deploymentUrl) ? `Internal server — ${INTERNAL_ACCESS_HINT}` : undefined}
          />
        )
      )}
      {canEdit && <ActionItem href={`/projects/${id}/edit`} icon={<Pencil size={18} />} label="Edit" />}
      {canDelete && (
        <ActionItem icon={<Trash2 size={18} />} label="Delete" tone="danger" onClick={() => setConfirmOpen(true)} />
      )}
      {error ? (
        <p role="alert" className="sr-only">
          {error}
        </p>
      ) : null}
      <ConfirmDialog
        open={confirmOpen}
        title="Delete project?"
        description={`This permanently deletes "${name}". This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
