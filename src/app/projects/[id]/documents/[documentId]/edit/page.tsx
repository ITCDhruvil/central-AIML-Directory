import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDocumentationById } from "@/lib/documents";
import { isEditableDocument } from "@/lib/documentOwnership";
import { DocumentForm } from "@/components/DocumentForm";

export default async function EditDocumentPage({
  params,
}: {
  params: Promise<{ id: string; documentId: string }>;
}) {
  const { id, documentId } = await params;
  const document = await getDocumentationById(id, documentId);

  if (!document) {
    notFound();
  }
  if (!isEditableDocument(document.source)) {
    redirect(`/projects/${id}/documents/${documentId}`);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href={`/projects/${id}/documents/${documentId}`}
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← Back to document
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-100">Edit Documentation</h1>
      </div>
      <DocumentForm
        projectId={id}
        document={{ id: document.id, title: document.title, category: document.category, content: document.content }}
        cancelHref={`/projects/${id}/documents/${documentId}`}
      />
    </div>
  );
}
