import type { Technology } from "@/types/technology";

export interface ProjectIconStyle {
  icon: "python" | "js" | "java" | "go" | "dotnet" | "rust" | "generic";
  colorClasses: string;
}

const RULES: Array<{ test: RegExp; style: ProjectIconStyle }> = [
  { test: /python/i, style: { icon: "python", colorClasses: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400" } },
  {
    test: /typescript|javascript|node|react|next\.?js|vue|angular/i,
    style: { icon: "js", colorClasses: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400" },
  },
  { test: /java\b|spring/i, style: { icon: "java", colorClasses: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400" } },
  { test: /\bgo\b|golang/i, style: { icon: "go", colorClasses: "bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-400" } },
  { test: /c#|\.net|dotnet/i, style: { icon: "dotnet", colorClasses: "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400" } },
  { test: /rust/i, style: { icon: "rust", colorClasses: "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400" } },
];

const FALLBACK: ProjectIconStyle = {
  icon: "generic",
  colorClasses: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

/** Picks a deterministic icon + color for a project's card avatar, based on its detected language technologies. */
export function projectIconStyle(technologies: Technology[]): ProjectIconStyle {
  const languages = technologies.filter((t) => t.category === "LANGUAGE" || t.category === "FRAMEWORK");
  const pool = languages.length > 0 ? languages : technologies;

  for (const tech of pool) {
    const rule = RULES.find((r) => r.test.test(tech.name));
    if (rule) return rule.style;
  }

  return FALLBACK;
}
