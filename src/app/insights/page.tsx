import { InsightsBoard } from "@/components/InsightsBoard";
import { CATALOG_INSIGHT_SCOPE, getInsightSnapshot } from "@/lib/insightCatalog";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const snapshot = await getInsightSnapshot(CATALOG_INSIGHT_SCOPE);
  return (
    <InsightsBoard
      initial={snapshot}
      emptyPrompt="Generate to see next moves across the directory."
    />
  );
}
