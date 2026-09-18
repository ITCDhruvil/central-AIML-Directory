import { IdeaForm } from "@/components/IdeaForm";

export default function NewIdeaPage() {
  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Add Idea</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Capture a problem worth solving.</p>
      </div>
      <IdeaForm cancelHref="/ideas" />
    </div>
  );
}
