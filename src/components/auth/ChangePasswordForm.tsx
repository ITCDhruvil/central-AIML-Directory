"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass, inputClass } from "@/components/auth/AuthCard";

export function ChangePasswordForm() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (newPassword !== confirm) {
      setError("New passwords do not match.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to change password");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {(
        [
          [
            "current",
            "Current (temporary) password",
            currentPassword,
            setCurrentPassword,
            "current-password",
          ],
          ["new", "New password", newPassword, setNewPassword, "new-password"],
          [
            "confirm",
            "Confirm new password",
            confirm,
            setConfirm,
            "new-password",
          ],
        ] as const
      ).map(([id, label, value, setValue, autoComplete]) => (
        <div key={id} className="space-y-1.5">
          <label
            htmlFor={id}
            className="text-xs font-medium text-zinc-600 dark:text-zinc-300"
          >
            {label}
          </label>
          <input
            id={id}
            type="password"
            required
            autoComplete={autoComplete}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={inputClass}
          />
        </div>
      ))}
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        At least 8 characters, with a letter and a number.
      </p>
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
