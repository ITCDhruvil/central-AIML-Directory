import Link from "next/link";
import { notFound } from "next/navigation";
import { getDocumentationById } from "@/lib/documents";
import { documentSourceLabel, isEditableDocument } from "@/lib/documentOwnership";
import { MarkdownView } from "@/components/MarkdownView";
import { DocumentActions } from "@/components/DocumentActions";

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string; documentId: string }>;
}) {
  const { id, documentId } = await params;
  const document = await getDocumentationById(id, documentId);

  if (!document) {
    notFound();
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href={`/projects/${id}`}
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            ← Back to project
          </Link>
          <div className="mt-2 flex items-center gap-2">
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{document.title}</h1>
            <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {document.category}
            </span>
            <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              {documentSourceLabel(document.source)}
            </span>
          </div>
          {document.source !== "manual" && <p className="mt-1 text-xs text-zinc-400">{document.filePath}</p>}
        </div>
        {isEditableDocument(document.source) && (
          <DocumentActions projectId={id} documentId={documentId} title={document.title} />
        )}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <MarkdownView content={document.content} />
      </div>
    </div>
  );
}
