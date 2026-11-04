"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, CheckSquare, ChevronsUpDown, Download, Eye, FileText, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { useCan } from "@/components/AuthProvider";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FileTypeTile } from "@/components/FileTypeTile";
import { SearchInput } from "@/components/SearchInput";
import { Button } from "@/components/ui/Button";
import { FilterMenu, type FilterOption, type FilterSection } from "@/components/ui/FilterMenu";
import { Pagination } from "@/components/ui/Pagination";
import { cn } from "@/lib/cn";
import { documentCategoryLabel, documentSourceLabel, isDeletableDocument, isEditableDocument } from "@/lib/documentOwnership";
import { KIND_TONE, fileKindOf, type FileKind } from "@/lib/fileKind";
import { formatDate } from "@/lib/formatDate";
import { uploadDocumentFile } from "@/lib/uploadClient";
import { usePagination } from "@/lib/usePagination";
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

const PAGE_SIZE = 10;

const SOURCE_OPTIONS: FilterOption[] = [
  { value: "github", label: "Repository" },
  { value: "generated", label: "Generated" },
  { value: "manual", label: "Written" },
  { value: UPLOAD_SOURCE, label: "Uploaded" },
];

const KIND_LABEL: Record<FileKind, string> = {
  pdf: "PDF",
  spreadsheet: "Spreadsheet",
  document: "Word document",
  markdown: "Markdown",
  text: "Text",
  presentation: "Presentation",
  image: "Image",
  archive: "Archive",
  code: "Code / data",
  other: "Other",
};

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

const SORT_PRESETS: { value: string; label: string; sort: Sort }[] = [
  { value: "", label: "Default order", sort: null },
  { value: "date-desc", label: "Newest first", sort: { key: "date", dir: "desc" } },
  { value: "date-asc", label: "Oldest first", sort: { key: "date", dir: "asc" } },
  { value: "name-asc", label: "Name A–Z", sort: { key: "name", dir: "asc" } },
  { value: "name-desc", label: "Name Z–A", sort: { key: "name", dir: "desc" } },
  { value: "size-desc", label: "Largest first", sort: { key: "size", dir: "desc" } },
  { value: "size-asc", label: "Smallest first", sort: { key: "size", dir: "asc" } },
];

function sortToPreset(sort: Sort): string {
  return SORT_PRESETS.find((p) => p.sort?.key === sort?.key && p.sort?.dir === sort?.dir)?.value ?? "";
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
  const [query, setQuery] = useState("");
  const [kinds, setKinds] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
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

  const kindOf = (d: DocumentRow): FileKind => fileKindOf(typeOf(d).ext, d.file?.contentType);

  // Only the types and sources that actually occur are offered as filters.
  const kindOptions: FilterOption[] = useMemo(() => {
    const present = new Set(documents.map(kindOf));
    return (Object.keys(KIND_LABEL) as FileKind[]).filter((k) => present.has(k)).map((k) => ({ value: k, label: KIND_LABEL[k] }));
  }, [documents]);
  const sourceOptions = SOURCE_OPTIONS.filter((o) => documents.some((d) => d.source === o.value));

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = documents.filter((d) => {
      if (sources.length > 0 && !sources.includes(d.source)) return false;
      if (kinds.length > 0 && !kinds.includes(kindOf(d))) return false;
      if (!q) return true;
      const haystack = [displayTitle(d.title, d.file), d.file?.name, typeOf(d).label, documentSourceLabel(d.source), documentCategoryLabel(d.category)];
      return haystack.some((text) => text?.toLowerCase().includes(q));
    });
    if (!sort) return list;
    const sign = sort.dir === "asc" ? 1 : -1;
    const compare: Record<SortKey, (a: DocumentRow, b: DocumentRow) => number> = {
      name: (a, b) => displayTitle(a.title, a.file).localeCompare(displayTitle(b.title, b.file), undefined, { numeric: true, sensitivity: "base" }),
      type: (a, b) => typeOf(a).label.localeCompare(typeOf(b).label),
      size: (a, b) => sizeOf(a) - sizeOf(b),
      date: (a, b) => new Date(dateOf(a)).getTime() - new Date(dateOf(b)).getTime(),
    };
    return [...list].sort((a, b) => sign * compare[sort.key](a, b));
  }, [documents, query, kinds, sources, sort]);

  const { pageItems, page, setPage, totalPages } = usePagination(visible, PAGE_SIZE);

  // Only written and uploaded documents can be deleted; synced and generated ones are managed by the sync.
  const deletable = pageItems.filter((d) => isDeletableDocument(d.source));
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

  const filterSections: FilterSection[] = [
    ...(kindOptions.length > 1
      ? [{ id: "type", label: "Type", kind: "multi" as const, options: kindOptions, selected: kinds, onChange: (v: string[]) => { setKinds(v); setPage(1); }, allLabel: "All types" }]
      : []),
    ...(sourceOptions.length > 1
      ? [{ id: "source", label: "Source", kind: "multi" as const, options: sourceOptions, selected: sources, onChange: (v: string[]) => { setSources(v); setPage(1); }, allLabel: "All sources" }]
      : []),
    {
      id: "sort",
      label: "Sort by",
      kind: "single",
      options: SORT_PRESETS.map((p) => ({ value: p.value, label: p.label })),
      selected: sortToPreset(sort),
      onChange: (v: string) => setSort(SORT_PRESETS.find((p) => p.value === v)?.sort ?? null),
      fallbackLabel: "Custom",
    },
  ];
  const activeFilterCount = (kinds.length > 0 ? 1 : 0) + (sources.length > 0 ? 1 : 0);

  function clearFilters() {
    setKinds([]);
    setSources([]);
    setPage(1);
  }

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

      {documents.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 px-5 pb-4">
          <div className="w-full sm:w-72">
            <SearchInput
              value={query}
              onChange={(value) => {
                setQuery(value);
                setPage(1);
              }}
              placeholder="Search documents..."
            />
          </div>
          <FilterMenu sections={filterSections} activeCount={activeFilterCount} onClear={clearFilters} />
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
            {pageItems.map((doc) => {
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

          {visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 border-t border-zinc-100 px-5 py-12 text-center dark:border-zinc-800">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">No documents match your search or filters.</p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setQuery("");
                  clearFilters();
                }}
              >
                Clear search and filters
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 px-5 py-3 dark:border-zinc-800">
              <span className="text-xs tabular-nums text-zinc-400">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, visible.length)} of {visible.length}
              </span>
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
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
