import "server-only";
import { prisma } from "@/lib/prisma";
import { DEFAULT_COLUMNS, normalizeColumns, type ColumnId } from "@/lib/projectTable";

const KEY = "projects.table.columns";

/** The columns every user sees in the projects table (set by an admin; defaults until then). */
export async function getProjectTableColumns(): Promise<ColumnId[]> {
  const row = await prisma.appSetting.findUnique({ where: { key: KEY } });
  if (!row) return [...DEFAULT_COLUMNS];
  try {
    return normalizeColumns(JSON.parse(row.value));
  } catch {
    return [...DEFAULT_COLUMNS];
  }
}

export async function setProjectTableColumns(raw: unknown): Promise<ColumnId[]> {
  const columns = normalizeColumns(raw);
  await prisma.appSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: JSON.stringify(columns) },
    update: { value: JSON.stringify(columns) },
  });
  return columns;
}
