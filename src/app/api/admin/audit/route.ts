import { NextRequest, NextResponse } from "next/server";
import { apiAuthorize } from "@/lib/auth/dal";
import { describeMeta } from "@/lib/auditCatalog";
import { parseAuditFilter } from "@/lib/auditFilter";
import { queryAudit } from "@/lib/auditQuery";
import { toCsv } from "@/lib/csv";

const CSV_LIMIT = 5000;

/**
 * The audit log, newest first. Needs permission to edit settings, since it shows who did what across the workspace.
 * `?format=csv` downloads the same filtered view (up to 5,000 rows).
 */
export async function GET(request: NextRequest) {
  const auth = await apiAuthorize("settings", "edit");
  if (!auth.ok) return auth.response;

  const params = request.nextUrl.searchParams;
  const filter = parseAuditFilter((k) => params.get(k));

  try {
    if (params.get("format") === "csv") {
      const { entries } = await queryAudit({ ...filter, page: 1 }, { pageSize: CSV_LIMIT });
      const csv = toCsv(
        ["When (UTC)", "Who", "Email", "Action", "Event", "Item", "Details", "IP"],
        entries.map((e) => [e.createdAt, e.actorName ?? "", e.actorEmail ?? "", e.action, e.label, [e.entityType, e.entityId].filter(Boolean).join(":"), describeMeta(e.meta), e.ip ?? ""]),
      );
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }
    return NextResponse.json(await queryAudit(filter));
  } catch (error) {
    console.error("GET /api/admin/audit failed", error);
    return NextResponse.json({ error: "Failed to load the audit log" }, { status: 500 });
  }
}
