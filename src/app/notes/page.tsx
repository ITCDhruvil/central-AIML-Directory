import { requireUser } from "@/lib/auth/dal";
import { StickyNote } from "lucide-react";
import { DayNoteCalendar } from "@/components/DayNoteCalendar";

export const dynamic = "force-dynamic";

export default async function MyNotesPage() {
  await requireUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          <StickyNote size={22} className="text-orange-500" />
          My Notes
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">A private daily journal. Pick a day and jot down what you worked on — only you can see these.</p>
      </div>
      <DayNoteCalendar apiBase="/api/me/day-notes" canEdit />
    </div>
  );
}
