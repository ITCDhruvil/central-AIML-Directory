export const TECHNOLOGY_CATEGORIES = [
  "LANGUAGE",
  "FRAMEWORK",
  "LIBRARY",
  "DATABASE",
  "CLOUD",
  "AI_ML",
  "TOOL",
  "RUNTIME",
  // Fallback bucket for technologies with no confident category — legacy
  // Phase 1-3 project data (plain strings) and manually-added entries land
  // here. Not part of the Phase 4 spec's list, added for compatibility.
  "OTHER",
] as const;

export type TechnologyCategory = (typeof TECHNOLOGY_CATEGORIES)[number];

export const CONFIDENCE_LEVELS = ["HIGH", "MEDIUM"] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export interface Technology {
  name: string;
  category: TechnologyCategory;
  evidence: string[];
  confidence: ConfidenceLevel;
}
