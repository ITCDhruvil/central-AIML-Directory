import "server-only";
import { prisma } from "@/lib/prisma";
import { DEFAULT_COLUMNS, normalizeColumns, type ColumnId } from "@/lib/projectTable";

const KEY = "projects.table.columns";
// Read every time the Projects page opens, so keep it in memory briefly like the other app settings. A change made here
// shows up immediately on this instance and within the TTL on any other.
const TTL_MS = 15_000;

let cached: { columns: ColumnId[]; expires: number } | null = null;

/** The columns every user sees in the projects table (set by an admin; defaults until then). */
export async function getProjectTableColumns(): Promise<ColumnId[]> {
  if (cached && cached.expires > Date.now()) return [...cached.columns];

  const row = await prisma.appSetting.findUnique({ where: { key: KEY } });
  let columns = [...DEFAULT_COLUMNS];
  if (row) {
    try {
      columns = normalizeColumns(JSON.parse(row.value));
    } catch {
      // Unreadable value: keep the defaults.
    }
  }
  cached = { columns, expires: Date.now() + TTL_MS };
  return [...columns];
}

export async function setProjectTableColumns(raw: unknown): Promise<ColumnId[]> {
  const columns = normalizeColumns(raw);
  await prisma.appSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: JSON.stringify(columns) },
    update: { value: JSON.stringify(columns) },
  });
  cached = { columns, expires: Date.now() + TTL_MS };
  return columns;
}
