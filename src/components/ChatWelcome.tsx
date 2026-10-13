"use client";

import { FolderOpen, House, Moon, Sparkles, Users } from "lucide-react";
import { useAuthUser } from "@/components/AuthProvider";
import { BrandLogo } from "@/components/BrandLogo";
import { GlowBulbIcon } from "@/components/icons/GlowBulbIcon";
import { BackgroundBeams } from "@/components/ui/background-beams";
import { ASSISTANT_NAME } from "@/lib/assistantName";
import { can } from "@/lib/auth/permissions";

type Starter = {
  icon: React.ElementType<{
    size?: number;
    strokeWidth?: number;
    className?: string;
  }>;
  label: string;
  /** What gets sent when the chip is clicked. */
  prompt: string;
  /** The permission the person needs for this to be worth offering. Omitted = everyone. */
  needs?: [resource: string, action: string];
};

// In priority order; the first six that this person is allowed to use are shown.
const STARTERS: Starter[] = [
  { icon: House, label: "Dashboard", prompt: "What's on the dashboard?" },
  {
    icon: FolderOpen,
    label: "Projects",
    prompt: "Show me my projects",
    needs: ["projects", "view"],
  },
  {
    icon: GlowBulbIcon,
    label: "Ideas",
    prompt: "What ideas do I have?",
    needs: ["ideas", "view"],
  },
  {
    icon: Sparkles,
    label: "Insights",
    prompt: "Generate new insights",
    needs: ["insights", "create"],
  },
  {
    icon: Users,
    label: "People",
    prompt: "Who are the users in the workspace?",
    needs: ["users", "view"],
  },
  { icon: Moon, label: "Dark mode", prompt: "Switch to dark mode" },
];

/** The first word of a name, for a friendly greeting. */
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";

// On a short panel the mark and the line under the greeting give way first, so the chips never need a scrollbar.
// (The rule lives in globals.css: the mark's own CSS sets display, which would beat a Tailwind utility.)
const HIDE_WHEN_SHORT = "chat-welcome-extra";

/** The chat's opening screen: a greeting and a few one-click starters that fit this person's access. */
export function ChatWelcome({ onPick }: { onPick: (prompt: string) => void }) {
  const user = useAuthUser();
  const starters = STARTERS.filter(
    (s) => !s.needs || (user && can(user.permissions, s.needs[0], s.needs[1])),
  ).slice(0, 6);
  const name = user ? firstName(user.name) : "";

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-5 text-center">
      <div className="flex flex-col items-center gap-3">
        {/* The same animated mark as the launch button, smaller. */}
        <div
          className={`assistant-launch assistant-avatar ${HIDE_WHEN_SHORT}`}
          aria-hidden
        >
          <BackgroundBeams count={18} viewBox="-120 90 520 200" />
          <span className="assistant-launch-frost" />
          <span className="assistant-launch-label">
            <BrandLogo size={26} className="dark:hidden" />
            <BrandLogo white size={26} className="hidden dark:block" />
          </span>
        </div>

        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {name
              ? `Hi ${name}, I'm ${ASSISTANT_NAME}`
              : `Hi, I'm ${ASSISTANT_NAME}`}
          </h2>
          <p
            className={`text-[13px] text-zinc-500 dark:text-zinc-400 ${HIDE_WHEN_SHORT}`}
          >
            How can I help?
          </p>
        </div>
      </div>

      <div className="grid w-full max-w-xs grid-cols-2 gap-2">
        {starters.map(({ icon: Icon, label, prompt }) => (
          <button
            key={label}
            type="button"
            onClick={() => onPick(prompt)}
            className="flex min-w-0 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-left text-[13px] font-medium text-zinc-700 transition-colors hover:border-orange-300 hover:bg-orange-50/60 hover:text-orange-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-orange-500/50 dark:hover:bg-orange-500/10 dark:hover:text-orange-300"
          >
            <Icon
              size={15}
              strokeWidth={1.9}
              className="shrink-0 text-orange-600 dark:text-orange-400"
            />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
