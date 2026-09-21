"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

/** Fixed-width gutter: hover shows the collapse control, drag resizes the side panel. */
export function PanelCollapseRail({
  collapsed,
  dragging,
  onToggle,
  onDragStart,
  onDrag,
  onDragEnd,
}: {
  collapsed: boolean;
  dragging: boolean;
  onToggle: () => void;
  onDragStart: (clientX: number) => void;
  onDrag: (clientX: number) => void;
  onDragEnd: () => void;
}) {
  const draggingRef = useRef(false);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    draggingRef.current = true;
    onDragStart(event.clientX);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    onDrag(event.clientX);
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    onDragEnd();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize project details"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={cn(
        "group relative hidden shrink-0 touch-none select-none lg:flex",
        collapsed ? "w-8 cursor-ew-resize" : "w-3 cursor-col-resize",
      )}
    >
      <div
        className={cn(
          "absolute inset-y-2 left-1/2 w-px -translate-x-1/2 transition-colors",
          dragging
            ? "bg-sky-500 dark:bg-sky-400"
            : collapsed
              ? "bg-zinc-200 dark:bg-zinc-700"
              : "bg-transparent group-hover:bg-sky-500",
        )}
      />

      <button
        type="button"
        onClick={onToggle}
        onPointerDown={(event) => event.stopPropagation()}
        title={collapsed ? "Show project details" : "Hide project details"}
        aria-label={collapsed ? "Show project details" : "Hide project details"}
        aria-expanded={!collapsed}
        className={cn(
          "absolute top-6 left-1/2 z-10 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 shadow-sm transition-opacity hover:text-zinc-800 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50",
          collapsed || dragging
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
        )}
      >
        {collapsed ? <ChevronLeft size={14} strokeWidth={2.25} /> : <ChevronRight size={14} strokeWidth={2.25} />}
      </button>
    </div>
  );
}
