"use client";

import { useState } from "react";
import { KeyRound, X } from "lucide-react";
import { TempPasswordNotice } from "@/components/admin/TempPasswordNotice";
import { RESET_REQUESTS_CHANGED } from "@/lib/resetRequestEvents";
import type { ResetRequestDto } from "@/lib/passwordResets";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Open "forgot password" requests. Resetting issues a temporary password (shown once) and closes the request. */
export function ResetRequests({ initial }: { initial: ResetRequestDto[] }) {
  const [requests, setRequests] = useState(initial);
  const [notice, setNotice] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reset(request: ResetRequestDto) {
    setBusyId(request.id);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/users/${request.userId}/reset-password`,
        { method: "POST" },
      );
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        temporaryPassword?: string;
      };
      if (!res.ok || !body.temporaryPassword) {
        setError(body.error ?? "Could not reset the password");
        return;
      }
      setNotice({ email: request.email, password: body.temporaryPassword });
      setRequests((prev) => prev.filter((r) => r.userId !== request.userId));
      window.dispatchEvent(new Event(RESET_REQUESTS_CHANGED));
    } catch {
      setError("Network error — please try again");
    } finally {
      setBusyId(null);
    }
  }

  async function dismiss(request: ResetRequestDto) {
    setBusyId(request.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reset-requests/${request.id}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 404) {
        setError("Could not dismiss the request");
        return;
      }
      setRequests((prev) => prev.filter((r) => r.id !== request.id));
      window.dispatchEvent(new Event(RESET_REQUESTS_CHANGED));
    } catch {
      setError("Network error — please try again");
    } finally {
      setBusyId(null);
    }
  }

  if (requests.length === 0 && !notice) return null;

  return (
    <div className="space-y-3">
      {notice && (
        <TempPasswordNotice
          email={notice.email}
          password={notice.password}
          onDismiss={() => setNotice(null)}
        />
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {requests.length > 0 && (
        <section className="rounded-xl border border-orange-200 bg-orange-50/60 dark:border-orange-500/30 dark:bg-orange-500/5">
          <h2 className="flex items-center gap-2 px-4 pt-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            <KeyRound size={15} className="text-orange-600" />
            Password reset requests
            <span className="rounded-full bg-orange-600 px-2 py-0.5 text-xs font-medium text-white">
              {requests.length}
            </span>
          </h2>
          <ul className="divide-y divide-orange-100 dark:divide-orange-500/20">
            {requests.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {r.name}
                  </p>
                  <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {r.email} · requested {formatWhen(r.createdAt)}
                  </p>
                  {r.viaSession && r.autoIssueAt && (
                    <p className="mt-0.5 text-xs text-orange-700 dark:text-orange-300">
                      Asked while signed in — gets a temporary password
                      automatically at {formatTime(r.autoIssueAt)} if nobody
                      answers.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => reset(r)}
                  className="h-8 rounded-md bg-orange-600 px-3 text-xs font-medium text-white hover:bg-orange-700 disabled:opacity-60"
                >
                  Set temporary password
                </button>
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => dismiss(r)}
                  aria-label={`Dismiss request from ${r.name}`}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-orange-100 disabled:opacity-60 dark:hover:bg-orange-500/20"
                >
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
