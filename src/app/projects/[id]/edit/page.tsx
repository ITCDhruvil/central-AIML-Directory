import { notFound } from "next/navigation";
import { getProjectById } from "@/lib/projects";
import { ProjectForm } from "@/components/ProjectForm";

export default async function EditProjectPage({
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
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Edit Project</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{project.name}</p>
      </div>
      <ProjectForm project={project} cancelHref={`/projects/${project.id}`} />
    </div>
  );
}
