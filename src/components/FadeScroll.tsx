"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Scrolls without a visible bar; a bottom fade marks leftover content and lifts at the end. */
export function FadeScroll({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [showFade, setShowFade] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const overflow = el.scrollHeight - el.clientHeight > 2;
    const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
    setShowFade(overflow && !atEnd);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    const inner = el.firstElementChild;
    if (inner) ro.observe(inner);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [update, children]);

  return (
    <div className={cn("relative min-h-0", className)}>
      <div
        ref={ref}
        className="h-full overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-zinc-100 to-transparent transition-opacity duration-200 dark:from-zinc-950",
          showFade ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}
