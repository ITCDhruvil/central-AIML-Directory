"use client";

import { useState } from "react";
import { Check, Copy, KeyRound, X } from "lucide-react";

/** Shows a generated temporary password once. It is never stored in readable form, so this is the only chance to copy it. */
export function TempPasswordNotice({
  email,
  password,
  onDismiss,
}: {
  email: string;
  password: string;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked: the password is still visible to select manually
    }
  }

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm dark:border-orange-500/30 dark:bg-orange-500/10"
    >
      <KeyRound size={16} className="shrink-0 text-orange-600" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-zinc-900 dark:text-zinc-100">
          Temporary password for <span className="break-all">{email}</span>
        </p>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          Shown once. Share it securely — they must set a new password at first sign-in.
        </p>
      </div>
      <code className="select-all rounded-md bg-white px-2.5 py-1 font-mono text-sm text-zinc-900 ring-1 ring-orange-200 dark:bg-zinc-900 dark:text-zinc-50 dark:ring-orange-500/30">
        {password}
      </code>
      <button
        type="button"
        onClick={copy}
        className="flex h-8 items-center gap-1.5 rounded-md border border-orange-300 px-2.5 text-xs font-medium text-orange-700 hover:bg-orange-100 dark:border-orange-500/40 dark:text-orange-300 dark:hover:bg-orange-500/20"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? "Copied" : "Copy"}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-orange-100 dark:hover:bg-orange-500/20"
      >
        <X size={16} />
      </button>
    </div>
  );
}
