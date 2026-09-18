"use client";

import Link from "next/link";
import { Menu } from "lucide-react";

export function TopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 px-3 sm:hidden">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open menu"
        className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-500 hover:bg-white hover:text-zinc-800"
      >
        <Menu size={18} strokeWidth={1.75} />
      </button>

      <Link href="/" className="flex min-w-0 items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        <span className="inline-block h-7 w-7 shrink-0 rounded-full bg-orange-600 shadow-[inset_0_1px_1px_rgba(255,255,255,0.28)]" aria-hidden />
        <span className="truncate">AIML Directory</span>
      </Link>
    </header>
  );
}
