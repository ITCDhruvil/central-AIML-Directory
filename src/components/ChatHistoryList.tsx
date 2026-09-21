"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, MotionConfig, motion, type Transition } from "motion/react";
import { Pin, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { pinnedAndRecent, type ChatConversation } from "@/lib/chatHistory";

const springConfig: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 40,
};

function MarqueeTitle({ text }: { text: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(0);

  useEffect(() => {
    const wrap = wrapRef.current;
    const el = textRef.current;
    if (!wrap || !el) return;

    function measure() {
      if (!wrap || !el) return;
      setOverflow(Math.max(0, el.scrollWidth - wrap.clientWidth));
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [text]);

  return (
    <div ref={wrapRef} className="min-w-0 flex-1 overflow-hidden">
      <span
        ref={textRef}
        className={cn("inline-block max-w-none whitespace-nowrap text-[13px] font-medium text-zinc-800 dark:text-zinc-100", overflow > 0 && "chat-title-marquee")}
        style={overflow > 0 ? ({ "--marquee-distance": `${overflow}px` } as CSSProperties) : undefined}
      >
        {text}
      </span>
    </div>
  );
}

function HistoryCard({
  conversation,
  active,
  onSelect,
  onPin,
  onDelete,
}: {
  conversation: ChatConversation;
  active: boolean;
  onSelect: (id: string) => void;
  onPin: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <motion.div
      layout
      layoutId={`chat-card-${conversation.id}`}
      transition={springConfig}
      onClick={() => onSelect(conversation.id)}
      className={cn(
        "group chat-history-card relative flex cursor-pointer items-center gap-2 rounded-2xl border p-2.5 shadow-xs transition-shadow hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900",
        active
          ? "border-orange-200 bg-white ring-1 ring-orange-500/20 dark:border-orange-500/30 dark:bg-zinc-800"
          : "border-gray-100 bg-[#F6F5FA]",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center">
        <MarqueeTitle text={conversation.title} />
      </div>

      <div className="relative z-10 flex shrink-0 items-center gap-1">
        <motion.button
          layout
          type="button"
          title={conversation.pinned ? "Unpin" : "Pin"}
          aria-label={conversation.pinned ? "Unpin chat" : "Pin chat"}
          onClick={(e) => {
            e.stopPropagation();
            onPin(conversation.id);
          }}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full transition-all duration-300",
            conversation.pinned
              ? "bg-orange-500 text-white opacity-0 group-hover:opacity-100"
              : "bg-[#CDCCD5] text-[#fefefe] opacity-0 group-hover:opacity-100 dark:bg-neutral-700 dark:text-neutral-400",
          )}
        >
          <Pin size={14} fill={conversation.pinned ? "currentColor" : "none"} />
        </motion.button>
        <motion.button
          layout
          type="button"
          title="Delete"
          aria-label="Delete chat"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(conversation.id);
          }}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-zinc-600 opacity-0 transition-all duration-300 group-hover:opacity-100 hover:bg-red-500 hover:text-white dark:bg-neutral-700 dark:text-neutral-300"
        >
          <Trash2 size={14} />
        </motion.button>
      </div>
    </motion.div>
  );
}

function Section({
  title,
  items,
  activeId,
  onSelect,
  onPin,
  onDelete,
}: {
  title: string;
  items: ChatConversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onPin: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
      <motion.h3 layout className="ml-1 text-[12px] font-semibold tracking-wider text-[#ADACB8] dark:text-neutral-500">
        {title}
      </motion.h3>
      <AnimatePresence>
        {items.map((conversation) => (
          <HistoryCard
            key={conversation.id}
            conversation={conversation}
            active={conversation.id === activeId}
            onSelect={onSelect}
            onPin={onPin}
            onDelete={onDelete}
          />
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

export function ChatHistoryList({
  conversations,
  activeId,
  onSelect,
  onPin,
  onDelete,
}: {
  conversations: ChatConversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onPin: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { pinned, recent } = pinnedAndRecent(conversations);

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 py-3">
        {conversations.length === 0 ? (
          <p className="px-1 pt-6 text-center text-[13px] text-zinc-400">No chats yet.</p>
        ) : (
          <>
            <Section title="Pinned" items={pinned} activeId={activeId} onSelect={onSelect} onPin={onPin} onDelete={onDelete} />
            <Section title="Recent" items={recent} activeId={activeId} onSelect={onSelect} onPin={onPin} onDelete={onDelete} />
          </>
        )}
      </div>
    </MotionConfig>
  );
}
