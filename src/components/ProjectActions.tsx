"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { isInternalDeploymentUrl, INTERNAL_ACCESS_HINT } from "@/lib/deploymentLabel";

export function ProjectActions({ id, name, deploymentUrl }: { id: string; name: string; deploymentUrl?: string | null }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Failed to delete project");
        setDeleting(false);
        setConfirmOpen(false);
        return;
      }
      router.push("/projects");
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
        {deploymentUrl && (
          <Button
            href={deploymentUrl}
            external
            variant="secondary"
            icon={ExternalLink}
            title={isInternalDeploymentUrl(deploymentUrl) ? `Internal server — ${INTERNAL_ACCESS_HINT}` : undefined}
          >
            Visit
          </Button>
        )}
        <Button href={`/projects/${id}/edit`} variant="secondary" icon={Pencil}>
          Edit
        </Button>
        <Button variant="danger" icon={Trash2} onClick={() => setConfirmOpen(true)}>
          Delete
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <ConfirmDialog
        open={confirmOpen}
        title="Delete project?"
        description={`This permanently deletes "${name}". This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
