import "server-only";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/csv";
import { exportFilename, listToCell } from "@/lib/dataExportMath";

export const EXPORT_TYPES = ["projects", "ideas", "owners", "backup"] as const;
export type ExportType = (typeof EXPORT_TYPES)[number];

export type ExportFile = { filename: string; contentType: string; body: string; count: number };

const iso = (d: Date | null) => (d ? d.toISOString() : "");

/** Builds a download of the whole directory. Admin-only (the caller checks); contains no passwords or sessions. */
export async function buildExport(type: ExportType): Promise<ExportFile> {
  if (type === "projects") {
    const rows = await prisma.project.findMany({ orderBy: { name: "asc" } });
    return {
      filename: exportFilename("projects", "csv"),
      contentType: "text/csv; charset=utf-8",
      count: rows.length,
      body: toCsv(
        ["Name", "Slug", "Type", "Status", "Stage", "Owner", "GitHub URL", "Technologies", "Tags", "Deployment URLs", "Description", "Created", "Updated"],
        rows.map((p) => [p.name, p.slug, p.type, p.status, p.stage ?? "", p.owner ?? "", p.githubUrl ?? "", listToCell(p.technologies), listToCell(p.tags), listToCell(p.deploymentUrls), p.description ?? "", iso(p.createdAt), iso(p.updatedAt)]),
      ),
    };
  }
  if (type === "ideas") {
    const rows = await prisma.idea.findMany({ orderBy: { name: "asc" } });
    return {
      filename: exportFilename("ideas", "csv"),
      contentType: "text/csv; charset=utf-8",
      count: rows.length,
      body: toCsv(
        ["Name", "Slug", "Status", "Owner", "Technologies", "Tags", "Description", "Created", "Updated"],
        rows.map((i) => [i.name, i.slug, i.status, i.owner ?? "", listToCell(i.technologies), listToCell(i.tags), i.description ?? "", iso(i.createdAt), iso(i.updatedAt)]),
      ),
    };
  }
  if (type === "owners") {
    const rows = await prisma.owner.findMany({ orderBy: { name: "asc" }, include: { user: { select: { email: true } } } });
    return {
      filename: exportFilename("owners", "csv"),
      contentType: "text/csv; charset=utf-8",
      count: rows.length,
      body: toCsv(["Owner name", "Linked account", "Created"], rows.map((o) => [o.name, o.user?.email ?? "", iso(o.createdAt)])),
    };
  }

  // Full backup: the raw records, so nothing is lost in translation. Documents and accounts are not included.
  const [projects, ideas, owners] = await Promise.all([
    prisma.project.findMany({ orderBy: { name: "asc" } }),
    prisma.idea.findMany({ orderBy: { name: "asc" } }),
    prisma.owner.findMany({ orderBy: { name: "asc" }, select: { name: true, createdAt: true } }),
  ]);
  return {
    filename: exportFilename("directory-backup", "json"),
    contentType: "application/json; charset=utf-8",
    count: projects.length + ideas.length + owners.length,
    body: JSON.stringify({ exportedAt: new Date().toISOString(), projects, ideas, owners }, null, 2),
  };
}
