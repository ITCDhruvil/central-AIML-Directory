"use client";

import { useState, type ReactNode } from "react";
import { FileText, LayoutGrid, Link2, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "documentation", label: "Documentation", icon: FileText },
  { id: "askAi", label: "Ask AI", icon: Sparkles },
  { id: "links", label: "Links", icon: Link2 },
] as const;

type TabId = (typeof TABS)[number]["id"];

/**
 * Real tabs — only the active panel's content is mounted, not a scroll-spy
 * over one long page. Each panel is server-rendered JSX handed in as a prop
 * (all data already fetched together server-side), so switching tabs is
 * just a client-side visibility swap, no extra fetch.
 */
export function ProjectDetailTabs({
  overview,
  documentation,
  askAi,
  links,
}: Record<TabId, ReactNode>) {
  const [active, setActive] = useState<TabId>("overview");
  const panels: Record<TabId, ReactNode> = { overview, documentation, askAi, links };

  return (
    <div>
      <nav className="flex gap-5 border-b border-zinc-200 dark:border-zinc-800">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            aria-current={active === tab.id ? "page" : undefined}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-0.5 py-2.5 text-sm font-medium transition-colors",
              active === tab.id
                ? "border-orange-600 text-orange-600 dark:border-orange-400 dark:text-orange-400"
                : "border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
            )}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </nav>
      <div className="mt-5 space-y-5">{panels[active]}</div>
    </div>
  );
}
