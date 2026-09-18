import {
  BookMarked,
  BrainCircuit,
  Cloud,
  Code2,
  Cpu,
  Database,
  Layers,
  Package,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { Technology, TechnologyCategory } from "@/types/technology";

export { TECHNOLOGY_CATEGORIES } from "@/types/technology";

export const TECHNOLOGY_CATEGORY_LABELS: Record<TechnologyCategory, string> = {
  LANGUAGE: "Languages",
  FRAMEWORK: "Frameworks",
  LIBRARY: "Libraries",
  DATABASE: "Database",
  CLOUD: "Cloud",
  AI_ML: "AI / ML",
  TOOL: "Tools",
  RUNTIME: "Runtime",
  OTHER: "Other",
};

/** One distinct icon per technology category, used anywhere a category row/badge is shown (e.g. Tech Stack Summary). */
export const TECHNOLOGY_CATEGORY_ICONS: Record<TechnologyCategory, LucideIcon> = {
  LANGUAGE: Code2,
  FRAMEWORK: Layers,
  LIBRARY: BookMarked,
  DATABASE: Database,
  CLOUD: Cloud,
  AI_ML: BrainCircuit,
  TOOL: Wrench,
  RUNTIME: Cpu,
  OTHER: Package,
};

/** True for technologies added by hand via the TechnologyEditor, not GitHub detection. */
export function isManualTechnology(tech: Technology): boolean {
  return tech.evidence.length === 1 && tech.evidence[0] === "manual";
}

export function groupTechnologiesByCategory(technologies: Technology[]): [TechnologyCategory, Technology[]][] {
  const groups = new Map<TechnologyCategory, Technology[]>();
  for (const tech of technologies) {
    const list = groups.get(tech.category) ?? [];
    list.push(tech);
    groups.set(tech.category, list);
  }
  return [...groups.entries()];
}
