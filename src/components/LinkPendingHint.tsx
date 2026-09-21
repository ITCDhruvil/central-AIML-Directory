"use client";

import { useLinkStatus } from "next/link";
import { cn } from "@/lib/cn";

/** Fixed-size pending hint inside a Link — visible only while that navigation is in flight. */
export function LinkPendingHint() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={cn(
        "h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500 transition-opacity duration-150",
        pending ? "animate-pulse opacity-80" : "opacity-0",
      )}
    />
  );
}
