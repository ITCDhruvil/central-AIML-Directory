"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Scrolls without a visible bar. While there is more below, a bottom fade and a round down-arrow button (centred at the
 * bottom of this area) say so; the button scrolls down a page and both go away at the end.
 */
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

  function scrollDown() {
    const el = ref.current;
    if (el) el.scrollBy({ top: Math.max(120, el.clientHeight * 0.8), behavior: "smooth" });
  }

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
      <button
        type="button"
        onClick={scrollDown}
        tabIndex={showFade ? 0 : -1}
        aria-hidden={!showFade}
        aria-label="Scroll down for more"
        title="Scroll down"
        className={cn(
          "absolute bottom-3 left-1/2 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-black/10 bg-black/5 text-zinc-700 backdrop-blur-md transition duration-200 hover:bg-black/10 dark:border-white/15 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10",
          showFade ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
        )}
      >
        <ChevronDown size={18} />
      </button>
    </div>
  );
}
