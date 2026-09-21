import { notFound } from "next/navigation";
import { AlignLeft, CalendarPlus, History, Lightbulb, Package, Rocket, User } from "lucide-react";
import { getIdeaById } from "@/lib/ideas";
import { IdeaStatusBadge } from "@/components/IdeaStatusBadge";
import { IdeaActions } from "@/components/IdeaActions";
import { MarkdownView } from "@/components/MarkdownView";
import { Button, type IconType } from "@/components/ui/Button";
import { Breadcrumb1 } from "@/components/ui/breadcrumb-01";
import { formatDate } from "@/lib/formatDate";
import { IDEA_STATUS_ICONS } from "@/lib/ideaOptionIcons";

function SectionCard({ icon: Icon, title, children }: { icon: IconType; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        <Icon size={16} className="text-zinc-400" />
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function InfoRow({ icon: Icon, iconClassName, label, value }: { icon: IconType; iconClassName?: string; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="flex shrink-0 items-center gap-2 text-zinc-500 dark:text-zinc-400">
        <Icon size={14} className={iconClassName} />
        {label}
      </span>
      <span className="font-medium text-zinc-800 dark:text-zinc-200">{value}</span>
    </div>
  );
}

export default async function IdeaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idea = await getIdeaById(id);

  if (!idea) {
    notFound();
  }

  return (
    <div className="w-full space-y-5">
      <Breadcrumb1
        segments={[
          { label: "Ideas", href: "/ideas" },
          { label: idea.name, current: true },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-500 dark:bg-amber-500/10 dark:text-amber-400">
            <Lightbulb size={22} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{idea.name}</h1>
              <IdeaStatusBadge status={idea.status} />
            </div>
          </div>
        </div>
        <IdeaActions id={idea.id} name={idea.name} promoted={idea.status === "PROMOTED"} promotedProjectId={idea.promotedProjectId} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {idea.status === "PROMOTED" && idea.promotedProjectId && (
            <div className="flex items-center gap-2 rounded-md border border-orange-200 bg-orange-50 px-3 py-2.5 text-sm text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300">
              <Rocket size={15} className="shrink-0" />
              This idea has been promoted.
              <Button href={`/projects/${idea.promotedProjectId}`} variant="secondary" size="sm" className="ml-auto">
                View Project
              </Button>
            </div>
          )}

          <SectionCard icon={AlignLeft} title="Description">
            {idea.description ? (
              <MarkdownView content={idea.description} />
            ) : (
              <p className="text-sm text-zinc-400">No description yet.</p>
            )}
          </SectionCard>
        </div>

        <div className="space-y-5">
          <SectionCard icon={Lightbulb} title="Idea Details">
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              <InfoRow
                icon={IDEA_STATUS_ICONS[idea.status].icon}
                iconClassName={IDEA_STATUS_ICONS[idea.status].className}
                label="Status"
                value={<IdeaStatusBadge status={idea.status} />}
              />
              <InfoRow icon={User} label="Owner" value={idea.owner ?? "Not set"} />
              <InfoRow icon={CalendarPlus} label="Created" value={formatDate(idea.createdAt)} />
              <InfoRow icon={History} label="Last Updated" value={formatDate(idea.updatedAt)} />
            </div>
          </SectionCard>

          {(idea.technologies.length > 0 || idea.tags.length > 0) && (
            <SectionCard icon={Package} title="Tech & Tags">
              {idea.technologies.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {idea.technologies.map((t) => (
                    <span key={t.name} className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {t.name}
                    </span>
                  ))}
                </div>
              )}
              {idea.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {idea.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-orange-50 px-2 py-0.5 text-xs text-orange-600 dark:bg-orange-500/10 dark:text-orange-400">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}
