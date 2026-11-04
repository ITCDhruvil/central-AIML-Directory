import { File, FileArchive, FileCode, FileImage, FileSpreadsheet, FileText, Presentation, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { KIND_TONE, fileKindOf, type FileKind } from "@/lib/fileKind";

export const KIND_ICON: Record<FileKind, LucideIcon> = {
  pdf: FileText,
  spreadsheet: FileSpreadsheet,
  document: FileText,
  markdown: FileText,
  text: FileText,
  presentation: Presentation,
  image: FileImage,
  archive: FileArchive,
  code: FileCode,
  other: File,
};

/** A coloured icon tile for a file type (green sheet for Excel / CSV, red for PDF, blue for Word, ...). */
export function FileTypeTile({
  extension,
  contentType,
  size = 36,
  className,
}: {
  extension: string;
  contentType?: string;
  /** Tile size in px; the icon is scaled to fit. */
  size?: number;
  className?: string;
}) {
  const kind = fileKindOf(extension, contentType);
  const Icon = KIND_ICON[kind];
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-lg", KIND_TONE[kind], className)} style={{ width: size, height: size }}>
      <Icon size={Math.round(size * 0.47)} />
    </span>
  );
}
