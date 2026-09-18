import { Layers, Tag, Lightbulb } from "lucide-react";
import type { Idea, IdeaStatus } from "@/types/idea";
import { ContentCard, formatCardDate, toneFromId } from "@/components/ContentCard";
import { IdeaCardMenu } from "@/components/IdeaCardMenu";
import { stripMarkdown } from "@/lib/stripMarkdown";

const STATUS_LABEL: Record<IdeaStatus, string> = {
  ACTIVE: "Active",
  ON_HOLD: "On hold",
  PROMOTED: "Promoted",
  ARCHIVED: "Archived",
};

export function IdeaCard({ idea }: { idea: Idea }) {
  const techCount = idea.technologies.length;
  const tagCount = idea.tags.length;

  return (
    <ContentCard
      href={`/ideas/${idea.id}`}
      tone={toneFromId(idea.id)}
      badge={STATUS_LABEL[idea.status]}
      visual={<Lightbulb size={32} />}
      title={idea.name}
      description={idea.description ? stripMarkdown(idea.description) : null}
      stats={[
        { icon: Layers, label: `${techCount} technolog${techCount === 1 ? "y" : "ies"}` },
        { icon: Tag, label: `${tagCount} tag${tagCount === 1 ? "" : "s"}` },
      ]}
      footerLeft={`Updated: ${formatCardDate(idea.updatedAt)}`}
      menu={<IdeaCardMenu id={idea.id} name={idea.name} promoted={idea.status === "PROMOTED"} />}
    />
  );
}
