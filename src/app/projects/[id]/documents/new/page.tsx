import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectById } from "@/lib/projects";
import { DocumentForm } from "@/components/DocumentForm";

export default async function NewDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProjectById(id);

  if (!project) {
    notFound();
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href={`/projects/${id}`}
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← Back to project
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-100">Add Documentation</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{project.name}</p>
      </div>
      <DocumentForm projectId={id} cancelHref={`/projects/${id}`} />
    </div>
  );
}
