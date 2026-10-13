"use client";

import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import type { ChatCredentials } from "@/lib/ai/chatbotRedact";

/**
 * Shows a generated password inside a chat reply. It exists only in this session's memory: the AI model
 * never receives it and it is stripped before the conversation is saved to this browser.
 */
export function ChatCredentialsCard({ credentials }: { credentials: ChatCredentials }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(credentials.password);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked; the password is visible to copy by hand
    }
  }

  return (
    <div className="mt-2 rounded-xl border border-orange-200 bg-orange-50 p-3 text-xs dark:border-orange-500/30 dark:bg-orange-500/10">
      <div className="flex items-center gap-1.5 font-medium text-zinc-900 dark:text-zinc-100">
        <KeyRound size={13} className="text-orange-600" />
        Temporary password
      </div>
      <p className="mt-1 break-all text-zinc-600 dark:text-zinc-300">{credentials.email}</p>
      <div className="mt-2 flex items-center gap-2">
        <code className="min-w-0 flex-1 select-all break-all rounded-md bg-white px-2 py-1 font-mono text-[13px] text-zinc-900 ring-1 ring-orange-200 dark:bg-zinc-900 dark:text-zinc-50 dark:ring-orange-500/30">
          {credentials.password}
        </code>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy password"
          className="flex h-7 shrink-0 items-center gap-1 rounded-md border border-orange-300 px-2 font-medium text-orange-700 hover:bg-orange-100 dark:border-orange-500/40 dark:text-orange-300 dark:hover:bg-orange-500/20"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
        {credentials.note ?? "They must set a new password at first sign-in."} Shown once — it isn&apos;t kept in your chat history.
      </p>
    </div>
  );
}
