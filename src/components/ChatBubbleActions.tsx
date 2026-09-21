"use client";

import { Check, Copy, RefreshCw, ThumbsDown, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/cn";

const ACTION =
  "flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-orange-50 hover:text-orange-600 disabled:opacity-40 dark:hover:bg-orange-500/15 dark:hover:text-orange-400";

export function ChatBubbleActions({
  role,
  copied,
  feedback,
  disabled,
  onCopy,
  onRegenerate,
  onFeedback,
}: {
  role: "user" | "assistant";
  copied: boolean;
  feedback?: "up" | "down";
  disabled?: boolean;
  onCopy: () => void;
  onRegenerate?: () => void;
  onFeedback?: (value: "up" | "down") => void;
}) {
  return (
    <div
      className={cn(
        "mt-1 flex items-center gap-0.5",
        role === "user" ? "justify-end opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" : "justify-start",
      )}
    >
      <button type="button" title={copied ? "Copied" : "Copy"} aria-label={copied ? "Copied" : "Copy"} onClick={onCopy} className={ACTION}>
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
      {role === "user" && onRegenerate && (
        <button type="button" title="Regenerate" aria-label="Regenerate" onClick={onRegenerate} disabled={disabled} className={ACTION}>
          <RefreshCw size={14} />
        </button>
      )}
      {role === "assistant" && onFeedback && (
        <>
          <button
            type="button"
            title="Good response"
            aria-label="Good response"
            aria-pressed={feedback === "up"}
            onClick={() => onFeedback("up")}
            className={cn(ACTION, feedback === "up" && "bg-green-50 text-green-600 dark:bg-green-500/15 dark:text-green-400")}
          >
            <ThumbsUp size={14} fill={feedback === "up" ? "currentColor" : "none"} />
          </button>
          <button
            type="button"
            title="Bad response"
            aria-label="Bad response"
            aria-pressed={feedback === "down"}
            onClick={() => onFeedback("down")}
            className={cn(ACTION, feedback === "down" && "bg-green-50 text-green-600 dark:bg-green-500/15 dark:text-green-400")}
          >
            <ThumbsDown size={14} fill={feedback === "down" ? "currentColor" : "none"} />
          </button>
        </>
      )}
    </div>
  );
}
