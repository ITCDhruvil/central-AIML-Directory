"use client";

import { cn } from "@/lib/cn";
import { useChatbot } from "@/components/ChatbotContext";

export function ChatbotLaunchButton({ collapsed }: { collapsed: boolean }) {
  const { open, toggle } = useChatbot();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={open ? "Close assistant" : "Open assistant"}
      aria-pressed={open}
      title={collapsed ? "Assistant" : undefined}
      className={cn("assistant-launch", collapsed && "assistant-launch-icon", open && "assistant-launch-open")}
    >
      {!collapsed && <span className="relative z-[2]">Assistant</span>}
      <span className="hoverEffect" aria-hidden>
        <span />
      </span>
    </button>
  );
}
