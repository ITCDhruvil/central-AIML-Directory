"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export function DocumentActions({
  projectId,
  documentId,
  title,
}: {
  projectId: string;
  documentId: string;
  title: string;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/documents/${documentId}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Failed to delete document");
        setDeleting(false);
        setConfirmOpen(false);
        return;
      }
      router.push(`/projects/${projectId}`);
      router.refresh();
    } catch {
      setError("Network error — please try again");
      setDeleting(false);
      setConfirmOpen(false);
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <Button href={`/projects/${projectId}/documents/${documentId}/edit`} variant="secondary" icon={Pencil}>
          Edit
        </Button>
        <Button variant="danger" icon={Trash2} onClick={() => setConfirmOpen(true)}>
          Delete
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <ConfirmDialog
        open={confirmOpen}
        title="Delete document?"
        description={`This permanently deletes "${title}". This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
