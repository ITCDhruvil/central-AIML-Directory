"use client";

import { BrandName } from "@/components/BrandingProvider";
import Link from "next/link";
import { Menu } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

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

      <Link
        href="/"
        className="flex min-w-0 items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100"
      >
        <BrandLogo size={28} />
        <span className="truncate">
          <BrandName />
        </span>
      </Link>
    </header>
  );
}
