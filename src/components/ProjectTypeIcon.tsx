import { Braces, Coffee, FileCode2, FolderKanban, Hash, Sigma, Zap } from "lucide-react";
import type { Technology } from "@/types/technology";
import { projectIconStyle } from "@/lib/projectIcon";
import { cn } from "@/lib/cn";

const ICONS = {
  python: FileCode2,
  js: Braces,
  java: Coffee,
  go: Zap,
  dotnet: Hash,
  rust: Sigma,
  generic: FolderKanban,
};

export function ProjectTypeIcon({
  technologies,
  size = 40,
  className,
  chrome = "tile",
}: {
  technologies: Technology[];
  size?: number;
  className?: string;
  chrome?: "tile" | "glyph";
}) {
  const style = projectIconStyle(technologies);
  const Icon = ICONS[style.icon];
  const textClasses = style.colorClasses
    .split(/\s+/)
    .filter((token) => token.includes("text-"))
    .join(" ");

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center",
        chrome === "tile" ? cn("rounded-xl", style.colorClasses) : textClasses,
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Icon size={size * 0.5} />
    </div>
  );
}
