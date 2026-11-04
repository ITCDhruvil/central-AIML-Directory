"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, CheckSquare, ChevronsUpDown, Download, Eye, FileText, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { useCan } from "@/components/AuthProvider";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FileTypeTile } from "@/components/FileTypeTile";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { documentCategoryLabel, documentSourceLabel, isDeletableDocument, isEditableDocument } from "@/lib/documentOwnership";
import { KIND_TONE, fileKindOf } from "@/lib/fileKind";
import { formatDate } from "@/lib/formatDate";
import { uploadDocumentFile } from "@/lib/uploadClient";
import { displayTitle, fileExtension, formatFileSize } from "@/lib/uploadFile";
import { UPLOAD_SOURCE, type DocumentFileInfo } from "@/types/documentation";

export interface DocumentRow {
  id: string;
  title: string;
  category: string;
  source: string;
  file: DocumentFileInfo | null;
  createdAt: string;
  updatedAt: string;
}

const FILTERS = [
  { id: "all", label: "All" },
  { id: "github", label: "Repository" },
  { id: "generated", label: "Generated" },
  { id: "manual", label: "Written" },
  { id: UPLOAD_SOURCE, label: "Uploaded" },
] as const;

type SortKey = "name" | "type" | "size" | "date";

// Name | Type | Size | Date | Actions. Type, size and date drop out on small screens (the name cell shows them instead).
const GRID = "md:grid md:grid-cols-[minmax(0,1fr)_5rem_5rem_7rem_8.5rem] md:items-center md:gap-4";

type Sort = { key: SortKey; dir: "asc" | "desc" } | null;

function SortHead({ id, label, sort, onToggle }: { id: SortKey; label: string; sort: Sort; onToggle: (key: SortKey) => void }) {
  const active = sort?.key === id;
  const Icon = !active ? ChevronsUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onToggle(id)}
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider transition-colors",
        active ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200",
      )}
    >
      {label}
      <Icon size={12} />
    </button>
  );
}

/** What a row's type column shows: the file extension for uploads, MD for written / synced Markdown documents. */
function typeOf(doc: DocumentRow): { ext: string; label: string } {
  if (doc.file) {
    const ext = fileExtension(doc.file.name);
    return { ext, label: ext ? ext.toUpperCase() : "FILE" };
  }
  return { ext: "md", label: "MD" };
}

function dateOf(doc: DocumentRow): string {
  return doc.file ? doc.createdAt : doc.updatedAt;
}

function sizeOf(doc: DocumentRow): number {
  return doc.file?.size ?? -1;
}

export function DocumentationPanel({
  projectId,
  documents,
  canCreate,
}: {
  projectId: string;
  documents: DocumentRow[];
  canCreate: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<string>("all");
  const [sort, setSort] = useState<Sort>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [added, setAdded] = useState(0);
  const [removed, setRemoved] = useState(0);
  const canDelete = useCan("documents", "delete");
  const canEdit = useCan("documents", "edit");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const present = new Set(documents.map((d) => d.source));
  const filters = FILTERS.filter((f) => f.id === "all" || present.has(f.id));
  const activeFilter = filters.some((f) => f.id === filter) ? filter : "all";

  const visible = useMemo(() => {
    const list = activeFilter === "all" ? documents : documents.filter((d) => d.source === activeFilter);
    if (!sort) return list;
    const sign = sort.dir === "asc" ? 1 : -1;
    const compare: Record<SortKey, (a: DocumentRow, b: DocumentRow) => number> = {
      name: (a, b) => displayTitle(a.title, a.file).localeCompare(displayTitle(b.title, b.file), undefined, { numeric: true, sensitivity: "base" }),
      type: (a, b) => typeOf(a).label.localeCompare(typeOf(b).label),
      size: (a, b) => sizeOf(a) - sizeOf(b),
      date: (a, b) => new Date(dateOf(a)).getTime() - new Date(dateOf(b)).getTime(),
    };
    return [...list].sort((a, b) => sign * compare[sort.key](a, b));
  }, [documents, activeFilter, sort]);

  // Only written and uploaded documents can be deleted; synced and generated ones are managed by the sync.
  const deletable = visible.filter((d) => isDeletableDocument(d.source));
  const canSelect = canDelete && documents.some((d) => isDeletableDocument(d.source));
  const allSelected = deletable.length > 0 && deletable.every((d) => selected.has(d.id));

  function toggleSort(key: SortKey) {
    setSort((prev) => (prev?.key !== key ? { key, dir: "asc" } : prev.dir === "asc" ? { key, dir: "desc" } : null));
  }

  function exitSelecting() {
    setSelecting(false);
    setSelected(new Set());
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(deletable.map((d) => d.id)));
  }

  async function deleteSelected() {
    setDeleting(true);
    setProblems([]);
    setAdded(0);
    const failed: string[] = [];
    let done = 0;
    for (const id of selected) {
      const title = documents.find((d) => d.id === id)?.title ?? "A document";
      try {
        const res = await fetch(`/api/projects/${projectId}/documents/${id}`, { method: "DELETE" });
        if (res.ok || res.status === 204) done += 1;
        else failed.push(`${title}: ${(await res.json().catch(() => ({}))).error ?? "could not be deleted"}`);
      } catch {
        failed.push(`${title}: network error`);
      }
    }
    setDeleting(false);
    setConfirmOpen(false);
    setRemoved(done);
    setProblems(failed);
    exitSelecting();
    if (done > 0) router.refresh();
  }

  async function upload(files: FileList | File[] | null) {
    const list = files ? Array.from(files) : [];
    if (list.length === 0 || uploading) return;
    setUploading(true);
    setProblems([]);
    setAdded(0);
    setRemoved(0);

    const failed: string[] = [];
    let created = 0;
    for (const file of list) {
      const result = await uploadDocumentFile(projectId, file);
      if (result.ok) created += 1;
      else failed.push(result.error);
    }

    setUploading(false);
    setProblems(failed);
    setAdded(created);
    if (inputRef.current) inputRef.current.value = "";
    if (created > 0) router.refresh();
  }

  const dropProps = canCreate
    ? {
        onDragOver: (e: React.DragEvent) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setDragging(true);
        },
        onDragLeave: (e: React.DragEvent) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
        },
        onDrop: (e: React.DragEvent) => {
          e.preventDefault();
          setDragging(false);
          void upload(e.dataTransfer.files);
        },
      }
    : {};

  return (
    <section
      {...dropProps}
      className={cn(
        "relative overflow-hidden rounded-xl border bg-white transition-colors dark:bg-zinc-900",
        dragging ? "border-orange-400 ring-2 ring-orange-400/30" : "border-zinc-200 dark:border-zinc-800",
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Documentation</h2>
          <span className="text-xs tabular-nums text-zinc-400">{documents.length}</span>
        </div>
        {selecting ? (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} className="size-4 accent-orange-600" />
              {selected.size > 0 ? `${selected.size} selected` : "Select all"}
            </label>
            <Button size="sm" variant="danger" icon={Trash2} disabled={selected.size === 0} onClick={() => setConfirmOpen(true)}>
              Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={exitSelecting}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {canSelect && (
              <Button size="sm" variant="ghost" icon={CheckSquare} onClick={() => setSelecting(true)}>
                Select
              </Button>
            )}
            {canCreate && (
              <>
                <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => void upload(e.target.files)} />
                <Button size="sm" icon={Upload} loading={uploading} onClick={() => inputRef.current?.click()}>
                  {uploading ? "Uploading" : "Upload"}
                </Button>
                <Button size="sm" variant="primary" icon={Plus} href={`/projects/${projectId}/documents/new`}>
                  New
                </Button>
              </>
            )}
          </div>
        )}
      </header>

      {(added > 0 || removed > 0 || problems.length > 0) && (
        <div className="mx-5 mb-3 space-y-1 rounded-lg bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-800/60">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              {added > 0 && (
                <p className="text-green-600 dark:text-green-400">
                  Added {added} document{added === 1 ? "" : "s"}.
                </p>
              )}
              {removed > 0 && (
                <p className="text-green-600 dark:text-green-400">
                  Deleted {removed} document{removed === 1 ? "" : "s"}.
                </p>
              )}
              {problems.map((problem) => (
                <p key={problem} className="text-red-600 dark:text-red-400">
                  {problem}
                </p>
              ))}
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => {
                setAdded(0);
                setRemoved(0);
                setProblems([]);
              }}
              className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {filters.length > 2 && (
        <div className="flex flex-wrap gap-1.5 px-5 pb-3">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                activeFilter === f.id
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {documents.length === 0 ? (
        <div className="px-5 pb-5">
          <button
            type="button"
            disabled={!canCreate}
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center rounded-lg border border-dashed border-zinc-300 px-6 py-12 text-center transition-colors enabled:hover:border-zinc-400 enabled:hover:bg-zinc-50 dark:border-zinc-700 dark:enabled:hover:bg-zinc-800/40"
          >
            <FileText size={22} className="text-zinc-300 dark:text-zinc-600" />
            <span className="mt-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">No documentation yet</span>
            <span className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {canCreate ? "Drop files here or click to upload. Any file type works." : "Nothing has been documented here yet."}
            </span>
          </button>
        </div>
      ) : (
        <div className="border-t border-zinc-100 dark:border-zinc-800">
          {/* Column headings (wide screens) */}
          <div className={cn("hidden border-b border-zinc-100 px-5 py-2.5 dark:border-zinc-800", GRID, selecting && "md:pl-12")}>
            <SortHead id="name" label="Name" sort={sort} onToggle={toggleSort} />
            <SortHead id="type" label="Type" sort={sort} onToggle={toggleSort} />
            <SortHead id="size" label="Size" sort={sort} onToggle={toggleSort} />
            <SortHead id="date" label="Date" sort={sort} onToggle={toggleSort} />
            <span className="text-right text-[11px] font-medium uppercase tracking-wider text-zinc-400">Actions</span>
          </div>

          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {visible.map((doc) => {
              const { ext, label } = typeOf(doc);
              const kind = fileKindOf(ext, doc.file?.contentType);
              const canPick = isDeletableDocument(doc.source);
              const picked = selected.has(doc.id);
              const title = displayTitle(doc.title, doc.file);
              const detailHref = `/projects/${projectId}/documents/${doc.id}`;
              const sub = doc.file
                ? documentSourceLabel(doc.source)
                : [documentSourceLabel(doc.source), doc.category !== "OTHER" ? documentCategoryLabel(doc.category) : null].filter(Boolean).join(" · ");
              const compact = [label, doc.file ? formatFileSize(doc.file.size) : null, formatDate(dateOf(doc))].filter(Boolean).join(" · ");

              const nameCell = (
                <span className="flex min-w-0 items-center gap-3">
                  <FileTypeTile extension={ext} contentType={doc.file?.contentType} size={36} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{title}</span>
                    <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="md:hidden">{compact}</span>
                      <span className="hidden md:inline">{sub}</span>
                    </span>
                  </span>
                </span>
              );

              const cells = (
                <>
                  <span className="hidden md:block">
                    <span className={cn("inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-semibold", KIND_TONE[kind])}>{label}</span>
                  </span>
                  <span className="hidden text-xs tabular-nums text-zinc-500 dark:text-zinc-400 md:block">{doc.file ? formatFileSize(doc.file.size) : "—"}</span>
                  <span className="hidden text-xs text-zinc-500 dark:text-zinc-400 md:block" title={doc.file ? "Added" : "Last updated"}>
                    {formatDate(dateOf(doc))}
                  </span>
                </>
              );

              if (selecting) {
                return (
                  <li key={doc.id} className={cn("flex items-center gap-3 px-5 py-3", picked && "bg-orange-50/60 dark:bg-orange-500/5", !canPick && "opacity-50")}>
                    <input
                      type="checkbox"
                      checked={picked}
                      disabled={!canPick}
                      onChange={() => toggle(doc.id)}
                      aria-label={`Select ${title}`}
                      title={canPick ? undefined : "Synced and generated documents can't be deleted here"}
                      className="size-4 shrink-0 accent-orange-600 disabled:cursor-not-allowed"
                    />
                    <button type="button" disabled={!canPick} onClick={() => toggle(doc.id)} className={cn("min-w-0 flex-1 text-left disabled:cursor-not-allowed", GRID)}>
                      {nameCell}
                      {cells}
                    </button>
                  </li>
                );
              }

              return (
                <li key={doc.id} className={cn("group relative flex items-center gap-2 px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40", GRID)}>
                  <Link href={detailHref} className="min-w-0 flex-1 md:contents">
                    <span className="min-w-0 md:block">{nameCell}</span>
                    {cells}
                  </Link>
                  <div className="flex shrink-0 items-center justify-end gap-0.5 text-zinc-400 transition md:opacity-0 md:focus-within:opacity-100 md:group-hover:opacity-100">
                    <Link href={detailHref} aria-label={`Preview ${title}`} title="Preview" className="rounded-md p-1.5 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100">
                      <Eye size={15} />
                    </Link>
                    {doc.file && (
                      <a
                        href={`/api/projects/${projectId}/documents/${doc.id}/file`}
                        aria-label={`Download ${doc.file.name}`}
                        title="Download"
                        className="rounded-md p-1.5 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                      >
                        <Download size={15} />
                      </a>
                    )}
                    {canEdit && isEditableDocument(doc.source) && (
                      <Link href={`${detailHref}/edit`} aria-label={`Edit ${title}`} title="Edit" className="rounded-md p-1.5 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100">
                        <Pencil size={15} />
                      </Link>
                    )}
                    {canDelete && canPick && (
                      <button
                        type="button"
                        aria-label={`Delete ${title}`}
                        title="Delete"
                        onClick={() => {
                          setSelected(new Set([doc.id]));
                          setConfirmOpen(true);
                        }}
                        className="rounded-md p-1.5 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={`Delete ${selected.size} document${selected.size === 1 ? "" : "s"}?`}
        description="This permanently deletes the selected documents and any uploaded files. It cannot be undone."
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={() => void deleteSelected()}
        onCancel={() => {
          setConfirmOpen(false);
          if (!selecting) setSelected(new Set());
        }}
      />

      {dragging && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/80 text-sm font-medium text-orange-600 dark:bg-zinc-900/80 dark:text-orange-400">
          Drop to upload
        </div>
      )}
    </section>
  );
}
