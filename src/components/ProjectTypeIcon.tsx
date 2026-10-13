import {
  AppWindow,
  Blocks,
  BrainCircuit,
  Braces,
  Coffee,
  FileCode2,
  Files,
  FolderKanban,
  Handshake,
  Hash,
  Library,
  LineChart,
  Rocket,
  ScanSearch,
  Search,
  Server,
  Sigma,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import type { Technology } from "@/types/technology";
import { projectIconStyle, type ProjectIconKey } from "@/lib/projectIcon";
import { cn } from "@/lib/cn";

const ICONS: Record<ProjectIconKey, typeof FolderKanban> = {
  scan: ScanSearch,
  chart: LineChart,
  handshake: Handshake,
  trash: Trash2,
  brain: BrainCircuit,
  library: Library,
  search: Search,
  files: Files,
  spark: Sparkles,
  window: AppWindow,
  blocks: Blocks,
  server: Server,
  bolt: Rocket,
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
  name,
  description,
  size = 40,
  className,
  chrome = "tile",
}: {
  technologies: Technology[];
  name?: string | null;
  description?: string | null;
  size?: number;
  className?: string;
  chrome?: "tile" | "glyph";
}) {
  const style = projectIconStyle({ name, description, technologies });
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
