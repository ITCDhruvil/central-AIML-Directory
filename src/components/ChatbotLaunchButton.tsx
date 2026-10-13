"use client";

import { BrandLogo } from "@/components/BrandLogo";
import { BackgroundBeams } from "@/components/ui/background-beams";
import { ASSISTANT_NAME } from "@/lib/assistantName";
import { cn } from "@/lib/cn";
import { useChatbot } from "@/components/ChatbotContext";

export function ChatbotLaunchButton({ collapsed }: { collapsed: boolean }) {
  const { open, toggle } = useChatbot();
  const label = `Ask ${ASSISTANT_NAME}`;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={open ? `Close ${ASSISTANT_NAME}` : label}
      aria-pressed={open}
      title={collapsed ? label : undefined}
      className={cn(
        "assistant-launch",
        collapsed && "assistant-launch-icon",
        open && "assistant-launch-open",
      )}
    >
      {/* Fewer beams on the small round button: it has less room, and every beam is an animation. */}
      <BackgroundBeams
        count={collapsed ? 18 : 30}
        viewBox={collapsed ? "40 90 260 260" : "-120 110 520 110"}
      />
      {/* Frosted glass between the beams (back) and the logo and label (front). */}
      <span aria-hidden className="assistant-launch-frost" />
      <span className="assistant-launch-label">
        {/* Large mark: it is the whole icon when the sidebar is collapsed. */}
        <BrandLogo size={collapsed ? 30 : 26} className="dark:hidden" />
        <BrandLogo
          white
          size={collapsed ? 30 : 26}
          className="hidden dark:block"
        />
        {!collapsed && label}
      </span>
    </button>
  );
}
