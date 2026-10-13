import type { Technology } from "@/types/technology";

export type ProjectIconKey =
  | "scan"
  | "chart"
  | "handshake"
  | "trash"
  | "brain"
  | "library"
  | "search"
  | "files"
  | "spark"
  | "window"
  | "blocks"
  | "server"
  | "bolt"
  | "python"
  | "js"
  | "java"
  | "go"
  | "dotnet"
  | "rust"
  | "generic";

export interface ProjectIconStyle {
  icon: ProjectIconKey;
  colorClasses: string;
}

interface IconRule {
  test: RegExp;
  style: ProjectIconStyle;
  /** Higher wins over a generic language match. Name matches count more than tech, tech more than description. */
  weight: number;
}

const RULES: IconRule[] = [
  { test: /spec-check|\brag\b|tender/i, weight: 12, style: { icon: "scan", colorClasses: "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400" } },
  { test: /forecast/i, weight: 12, style: { icon: "chart", colorClasses: "bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400" } },
  { test: /negotiat/i, weight: 12, style: { icon: "handshake", colorClasses: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" } },
  { test: /auto-delete|tempclean|delete files/i, weight: 12, style: { icon: "trash", colorClasses: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400" } },
  { test: /hyperlink|pytorch|pdf section/i, weight: 12, style: { icon: "brain", colorClasses: "bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-500/10 dark:text-fuchsia-400" } },
  { test: /knowledge/i, weight: 12, style: { icon: "library", colorClasses: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400" } },
  { test: /contract search|context-key/i, weight: 12, style: { icon: "search", colorClasses: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400" } },
  { test: /\brfq\b|\brfp\b|document intelligence/i, weight: 11, style: { icon: "files", colorClasses: "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400" } },
  { test: /\bspark\b/i, weight: 12, style: { icon: "spark", colorClasses: "bg-amber-50 text-amber-500 dark:bg-amber-500/10 dark:text-amber-400" } },
  { test: /prototype|\bhtml\b/i, weight: 8, style: { icon: "window", colorClasses: "bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-400" } },
  { test: /django/i, weight: 5, style: { icon: "server", colorClasses: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400" } },
  { test: /fastapi/i, weight: 5, style: { icon: "bolt", colorClasses: "bg-lime-50 text-lime-700 dark:bg-lime-500/10 dark:text-lime-400" } },
  { test: /next\.?js/i, weight: 4, style: { icon: "blocks", colorClasses: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200" } },
  { test: /python/i, weight: 3, style: { icon: "python", colorClasses: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400" } },
  { test: /typescript|javascript|node|react|vue|angular/i, weight: 2, style: { icon: "js", colorClasses: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400" } },
  { test: /java\b|spring/i, weight: 3, style: { icon: "java", colorClasses: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400" } },
  { test: /\bgo\b|golang/i, weight: 3, style: { icon: "go", colorClasses: "bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-400" } },
  { test: /c#|asp\.net|\.net\b|dotnet/i, weight: 6, style: { icon: "dotnet", colorClasses: "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400" } },
  { test: /rust/i, weight: 3, style: { icon: "rust", colorClasses: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300" } },
];

const FALLBACK: ProjectIconStyle = {
  icon: "generic",
  colorClasses: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

function fieldScore(rule: IconRule, text: string, multiplier: number): number {
  return text && rule.test.test(text) ? rule.weight * multiplier : 0;
}

/** Picks a card icon from what the project is for, then its stack. A purpose match beats a shared language. */
export function projectIconStyle(input: {
  name?: string | null;
  description?: string | null;
  technologies: Technology[];
}): ProjectIconStyle {
  const name = input.name ?? "";
  const description = input.description ?? "";
  const techText = input.technologies.map((tech) => tech.name).join(" ");

  let best: IconRule | null = null;
  let bestScore = 0;
  for (const rule of RULES) {
    const score = Math.max(
      fieldScore(rule, name, 3),
      fieldScore(rule, techText, 2),
      fieldScore(rule, description, 1),
    );
    if (score > bestScore) {
      best = rule;
      bestScore = score;
    }
  }

  return best?.style ?? FALLBACK;
}
