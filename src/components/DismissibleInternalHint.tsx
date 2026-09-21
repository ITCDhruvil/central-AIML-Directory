"use client";

import { useEffect, useState } from "react";
import { Shield, X } from "lucide-react";

const EVENT = "project-internal-hint-dismissed";

function storageKey(projectId: string) {
  return `project-internal-hint-dismissed:${projectId}`;
}

export function DismissibleInternalHint({ projectId }: { projectId: string }) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    function read() {
      setDismissed(window.localStorage.getItem(storageKey(projectId)) === "1");
    }
    read();
    window.addEventListener("storage", read);
    window.addEventListener(EVENT, read);
    return () => {
      window.removeEventListener("storage", read);
      window.removeEventListener(EVENT, read);
    };
  }, [projectId]);

  if (dismissed) return null;

  function dismiss() {
    window.localStorage.setItem(storageKey(projectId), "1");
    window.dispatchEvent(new Event(EVENT));
  }

  return (
    <div className="flex max-w-sm items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
      <Shield size={16} className="mt-0.5 shrink-0" />
      <p className="min-w-0 leading-snug">
        This project is deployed on an internal server. You need VPN or remote access to open it.
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss internal server notice"
        title="Dismiss"
        className="-mr-1 -mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-amber-700/80 hover:bg-amber-100 hover:text-amber-950 dark:text-amber-300 dark:hover:bg-amber-500/20 dark:hover:text-amber-50"
      >
        <X size={14} strokeWidth={2.25} />
      </button>
    </div>
  );
}
