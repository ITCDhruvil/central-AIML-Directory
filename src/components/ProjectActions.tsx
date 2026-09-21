"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FLUID_TAB_ITEM } from "@/components/ui/FluidTabs";
import { cn } from "@/lib/cn";
import { isInternalDeploymentUrl, INTERNAL_ACCESS_HINT } from "@/lib/deploymentLabel";

function ActionItem({
  icon,
  label,
  href,
  external,
  onClick,
  title,
  tone = "neutral",
}: {
  icon: ReactNode;
  label: string;
  href?: string;
  external?: boolean;
  onClick?: () => void;
  title?: string;
  tone?: "neutral" | "accent" | "danger";
}) {
  const toneClass =
    tone === "accent"
      ? "font-semibold text-orange-600 dark:text-orange-400"
      : tone === "danger"
        ? "font-semibold text-red-600 dark:text-red-400"
        : "font-semibold text-[#585652] group-hover:dark:text-neutral-300 dark:text-neutral-500";

  const inner = (
    <>
      <span className="absolute inset-0 rounded-full border border-[#fefefe]/90 bg-gradient-to-b from-[#fefefe] to-gray-50/80 opacity-0 shadow-xs transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 dark:border-neutral-600/50 dark:from-neutral-700 dark:to-neutral-800/90" />
      <span className={cn("relative z-10 flex items-center gap-1.5 sm:gap-3", toneClass)}>
        <span className="flex shrink-0 items-center justify-center">{icon}</span>
        <span className="text-sm tracking-tight whitespace-nowrap sm:text-base">{label}</span>
      </span>
    </>
  );

  const className = FLUID_TAB_ITEM;

  if (href && external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" title={title} className={className}>
        {inner}
      </a>
    );
  }

  if (href) {
    return (
      <Link href={href} title={title} className={className}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} title={title} className={className}>
      {inner}
    </button>
  );
}

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
    <>
      {deploymentUrl && (
        <ActionItem
          href={deploymentUrl}
          external
          icon={<ExternalLink size={18} />}
          label="Visit"
          tone="accent"
          title={isInternalDeploymentUrl(deploymentUrl) ? `Internal server — ${INTERNAL_ACCESS_HINT}` : undefined}
        />
      )}
      <ActionItem href={`/projects/${id}/edit`} icon={<Pencil size={18} />} label="Edit" />
      <ActionItem icon={<Trash2 size={18} />} label="Delete" tone="danger" onClick={() => setConfirmOpen(true)} />
      {error ? (
        <p role="alert" className="sr-only">
          {error}
        </p>
      ) : null}
      <ConfirmDialog
        open={confirmOpen}
        title="Delete project?"
        description={`This permanently deletes "${name}". This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
