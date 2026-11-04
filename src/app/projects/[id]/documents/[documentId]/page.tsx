import { requirePagePermission } from "@/lib/auth/dal";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, ExternalLink, File as FileIcon, FileText } from "lucide-react";
import { getDocumentationById } from "@/lib/documents";
import {
  documentCategoryLabel,
  documentSourceLabel,
  isDeletableDocument,
  isEditableDocument,
} from "@/lib/documentOwnership";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/formatDate";
import { displayTitle, fileExtension, formatFileSize, isInlineSafe } from "@/lib/uploadFile";
import { MarkdownView } from "@/components/MarkdownView";
import { FilePreview } from "@/components/FilePreview";
import { FileTypeTile } from "@/components/FileTypeTile";
import { previewKindFor } from "@/lib/fileKind";
import { DocumentActions } from "@/components/DocumentActions";

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string; documentId: string }>;
}) {
  const { access } = await requirePagePermission("documents", "view");
  const { id, documentId } = await params;
  const document = await getDocumentationById(id, documentId, access);

  if (!document) {
    notFound();
  }

  const file = document.file ?? null;
  const fileUrl = `/api/projects/${id}/documents/${documentId}/file`;
  const isPdf = file?.contentType === "application/pdf";
  const isImage = Boolean(file?.contentType.startsWith("image/")) && isInlineSafe(file?.contentType ?? "");
  const extension = file ? fileExtension(file.name) : "";
  const canPreview = Boolean(file) && previewKindFor(extension) !== null;

  // One meta line for every kind of document: what it is, where it came from, and when.
  const meta = file
    ? [fileExtension(file.name).toUpperCase(), formatFileSize(file.size), `Added ${formatDate(document.createdAt)}`]
    : [
        documentCategoryLabel(document.category),
        documentSourceLabel(document.source),
        `Updated ${formatDate(document.updatedAt)}`,
      ];
  const subtitle = file ? file.name : document.source !== "manual" ? document.filePath : null;

  return (
    <div className={cn("mx-auto w-full space-y-5", file ? "max-w-6xl" : "max-w-4xl")}>
      <Link
        href={`/projects/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        <ArrowLeft size={14} />
        Back to project
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {file ? (
            <FileTypeTile extension={extension} contentType={file.contentType} size={44} className="rounded-xl" />
          ) : (
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              <FileText size={20} />
            </span>
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              {displayTitle(document.title, file)}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-zinc-500 dark:text-zinc-400">
              {subtitle && (
                <>
                  <span className="truncate" title={subtitle}>
                    {subtitle}
                  </span>
                  <span className="text-zinc-300 dark:text-zinc-600">·</span>
                </>
              )}
              {meta.join(" · ")}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {file && (isPdf || isImage) && (
            <Button href={`${fileUrl}?inline=1`} external variant="secondary" icon={ExternalLink}>
              Open
            </Button>
          )}
          {file && (
            <Button href={fileUrl} external variant="primary" icon={Download}>
              Download
            </Button>
          )}
          {isDeletableDocument(document.source) && (
            <DocumentActions
              projectId={id}
              documentId={documentId}
              title={displayTitle(document.title, file)}
              editable={isEditableDocument(document.source)}
            />
          )}
        </div>
      </div>

      {file ? (
        isPdf ? (
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
            {/* navpanes=0 hides the thumbnail rail; the viewer keeps its own page and zoom controls. */}
            <iframe
              title={file.name}
              src={`${fileUrl}?inline=1#navpanes=0&view=FitH`}
              className="block h-[calc(100vh-13rem)] min-h-[480px] w-full"
            />
          </div>
        ) : isImage ? (
          <div className="flex justify-center overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={file.name}
              src={`${fileUrl}?inline=1`}
              className="max-h-[calc(100vh-14rem)] max-w-full rounded-lg object-contain"
            />
          </div>
        ) : canPreview ? (
          <FilePreview projectId={id} documentId={documentId} fileName={file.name} />
        ) : (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-zinc-300 px-6 py-20 text-center dark:border-zinc-700">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 dark:bg-zinc-800">
              <FileIcon size={26} />
            </span>
            <p className="mt-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">No preview for this file type</p>
            <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
              Your browser can&apos;t show {fileExtension(file.name).toUpperCase() || "this"} files here. Download it to open it in the right app.
            </p>
            <Button href={fileUrl} external variant="primary" icon={Download} className="mt-5">
              Download {file.name}
            </Button>
          </div>
        )
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white px-6 py-7 dark:border-zinc-800 dark:bg-zinc-900 sm:px-10 sm:py-9">
          <MarkdownView content={document.content} />
        </div>
      )}
    </div>
  );
}
