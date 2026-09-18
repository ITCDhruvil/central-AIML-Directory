"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Rocket, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export function IdeaActions({
  id,
  name,
  promoted,
  promotedProjectId,
}: {
  id: string;
  name: string;
  promoted: boolean;
  promotedProjectId: string | null;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/ideas/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Failed to delete idea");
        setDeleting(false);
        setConfirmOpen(false);
        return;
      }
      router.push("/ideas");
      router.refresh();
    } catch {
      setError("Network error — please try again");
      setDeleting(false);
      setConfirmOpen(false);
    }
  }

  async function handlePromote() {
    setPromoting(true);
    setError(null);
    try {
      const res = await fetch(`/api/ideas/${id}/promote`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Failed to promote idea");
        setPromoting(false);
        return;
      }
      router.push(`/projects/${body.project.id}`);
      router.refresh();
    } catch {
      setError("Network error — please try again");
      setPromoting(false);
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        {promoted ? (
          promotedProjectId && (
            <Button href={`/projects/${promotedProjectId}`} variant="primary" icon={Rocket}>
              View Project
            </Button>
          )
        ) : (
          <Button variant="primary" icon={Rocket} loading={promoting} onClick={handlePromote}>
            {promoting ? "Promoting..." : "Promote to Project"}
          </Button>
        )}
        <Button href={`/ideas/${id}/edit`} variant="secondary" icon={Pencil}>
          Edit
        </Button>
        <Button variant="danger" icon={Trash2} onClick={() => setConfirmOpen(true)}>
          Delete
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <ConfirmDialog
        open={confirmOpen}
        title="Delete idea?"
        description={`This permanently deletes "${name}". This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
