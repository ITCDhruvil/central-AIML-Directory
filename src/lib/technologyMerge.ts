import type { Technology } from "@/types/technology";

/** Adds AI-suggested technology names that are not already present, as low-confidence "Other" entries. */
export function mergeSuggestedTechnologies(prev: Technology[], suggested: string[]): Technology[] {
  const existing = new Set(prev.map((t) => t.name.toLowerCase()));
  const next = [...prev];
  for (const techName of suggested) {
    const trimmed = techName.trim();
    if (!trimmed || existing.has(trimmed.toLowerCase())) continue;
    next.push({ name: trimmed, category: "OTHER", evidence: ["ai-suggested"], confidence: "MEDIUM" });
    existing.add(trimmed.toLowerCase());
  }
  return next;
}
