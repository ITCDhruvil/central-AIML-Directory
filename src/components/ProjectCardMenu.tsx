"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { GithubIcon } from "@/components/icons/GithubIcon";
import { useClickOutside } from "@/lib/useClickOutside";

export function ProjectCardMenu({
  id,
  name,
  githubUrl,
}: {
  id: string;
  name: string;
  githubUrl: string | null;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useClickOutside(menuRef, () => setMenuOpen(false), menuOpen);

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
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  }

  const itemClasses =
    "flex items-center gap-2 px-3 py-1.5 text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800";

  return (
    <>
      <div ref={menuRef} className="relative shrink-0">
        <button
          type="button"
          aria-label={`Actions for ${name}`}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <MoreHorizontal size={16} />
        </button>
        {menuOpen && (
          <div className="absolute right-0 z-10 mt-1 w-44 rounded-md border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            <Link href={`/projects/${id}/edit`} className={itemClasses} onClick={() => setMenuOpen(false)}>
              <Pencil size={14} />
              Edit
            </Link>
            {githubUrl && (
              <>
                <a href={githubUrl} target="_blank" rel="noopener noreferrer" className={itemClasses} onClick={() => setMenuOpen(false)}>
                  <GithubIcon size={14} />
                  Open GitHub
                </a>
                <Link href={`/projects/${id}#sync`} className={itemClasses} onClick={() => setMenuOpen(false)}>
                  <RefreshCw size={14} />
                  Sync GitHub
                </Link>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setConfirmOpen(true);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
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
