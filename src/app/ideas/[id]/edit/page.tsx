import { notFound } from "next/navigation";
import { getIdeaById } from "@/lib/ideas";
import { IdeaForm } from "@/components/IdeaForm";

export default async function EditIdeaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idea = await getIdeaById(id);

  if (!idea) {
    notFound();
  }

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Edit Idea</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{idea.name}</p>
      </div>
      <IdeaForm idea={idea} cancelHref={`/ideas/${idea.id}`} />
    </div>
  );
}
