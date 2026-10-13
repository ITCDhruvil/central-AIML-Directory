import { requirePagePermission } from "@/lib/auth/dal";
import { redirect } from "next/navigation";
import { InsightsBoard } from "@/components/InsightsBoard";
import { CATALOG_INSIGHT_SCOPE, getInsightSnapshot } from "@/lib/insightCatalog";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const { access } = await requirePagePermission("insights", "view");
  // Insights analyse the whole directory, so users limited to their own items can't open them.
  if (!access.all) redirect("/");
  const snapshot = await getInsightSnapshot(CATALOG_INSIGHT_SCOPE);
  return (
    <InsightsBoard
      initial={snapshot}
      emptyPrompt="Generate to see next moves across the directory."
    />
  );
}
