"use client";

import { useEffect, useState } from "react";
import { AtSign } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

type Message = { kind: "ok" | "error"; text: string };

/**
 * Admin-only control for the email domain everyone signs in with. The sign-in page shows it as a fixed suffix, so people
 * type only their username; new accounts must use it too. Changing it is guarded on the server (see the API route).
 */
export function EmailDomainSetting() {
  const [saved, setSaved] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [confirm, setConfirm] = useState<{ text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/email-domain")
      .then((r) => r.json())
      .then((body: { domain?: string }) => {
        if (cancelled || !body.domain) return;
        setSaved(body.domain);
        setDraft(body.domain);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(confirmed = false) {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/email-domain", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: draft, confirm: confirmed }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        domain?: string;
        needsConfirm?: boolean;
      };
      if (res.status === 409 && body.needsConfirm) {
        setConfirm({ text: body.error ?? "Some accounts would be affected." });
        return;
      }
      if (!res.ok || !body.domain) {
        setMessage({ kind: "error", text: body.error ?? "Failed to save" });
        return;
      }
      setSaved(body.domain);
      setDraft(body.domain);
      setMessage({ kind: "ok", text: `Sign-in now uses @${body.domain}.` });
    } catch {
      setMessage({ kind: "error", text: "Network error — please try again" });
    } finally {
      setSaving(false);
      setConfirm(null);
    }
  }

  const dirty =
    saved !== null && draft.trim().replace(/^@+/, "").toLowerCase() !== saved;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        Sign-in email domain
      </h2>
      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
        People sign in with just their username; this domain is added for them.
        New accounts must be on it too.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="field flex h-10 w-full max-w-xs items-center gap-2 py-0">
          <AtSign size={15} className="shrink-0 text-zinc-400" aria-hidden />
          <input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setMessage(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && dirty) void save();
            }}
            spellCheck={false}
            autoCapitalize="none"
            aria-label="Sign-in email domain"
            placeholder="company.com"
            disabled={saved === null}
            className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-zinc-400"
          />
        </div>
        <Button
          variant="primary"
          loading={saving}
          disabled={!dirty}
          onClick={() => void save()}
        >
          Save
        </Button>
      </div>

      {message && (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={cn(
            "mt-2 text-xs",
            message.kind === "error"
              ? "text-red-600"
              : "text-green-600 dark:text-green-400",
          )}
        >
          {message.text}
        </p>
      )}

      <ConfirmDialog
        open={confirm !== null}
        title="Change the sign-in domain?"
        description={`${confirm?.text ?? ""} They would need an admin to move them to the new domain.`}
        confirmLabel="Change anyway"
        loading={saving}
        onConfirm={() => void save(true)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
