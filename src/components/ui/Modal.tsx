"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Centered dialog with a dimmed backdrop. Closes on Escape or backdrop click and locks page scroll
 * while open. Header and footer stay fixed; only the body scrolls on short screens.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  children,
  className,
  dismissible = true,
  hideHeader = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** false hides the close button and ignores Escape and backdrop clicks, for steps that must be completed. */
  dismissible?: boolean;
  /** Drops the title bar so the body can lay out its own heading. `title` is still used as the accessible name. */
  hideHeader?: boolean;
}) {
  const titleId = useId();
  // Rendered into document.body so a transformed or clipped ancestor (e.g. an animated card) can't trap the backdrop.
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  // Stay mounted briefly after `open` turns false so the exit fade can play.
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    if (open || !mounted) return;
    const timer = window.setTimeout(() => setMounted(false), 160);
    return () => window.clearTimeout(timer);
  }, [open, mounted]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && dismissible) onClose();
    }
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose, dismissible]);

  if (!isClient || (!open && !mounted)) return null;

  return createPortal(
    <div data-closing={!open} className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        aria-label="Close dialog"
        tabIndex={-1}
        onClick={dismissible ? onClose : undefined}
        className="modal-backdrop absolute inset-0 cursor-default bg-zinc-950/45 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={hideHeader ? undefined : titleId}
        aria-label={hideHeader ? title : undefined}
        className={cn(
          "modal-panel relative flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10",
          className,
        )}
      >
        {!hideHeader && (
          <header className="flex items-start justify-between gap-4 border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
            <div>
              <h2 id={titleId} className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                {title}
              </h2>
              {description && <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>}
            </div>
            {dismissible && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                <X size={18} />
              </button>
            )}
          </header>
        )}
        <div className={cn("min-h-0 flex-1 overflow-y-auto px-6 py-5", hideHeader && "px-7 py-7")}>{children}</div>
        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-zinc-100 bg-zinc-50/60 px-6 py-3.5 dark:border-zinc-800 dark:bg-zinc-900">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
