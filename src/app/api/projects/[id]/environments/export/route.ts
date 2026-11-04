import { NextRequest, NextResponse } from "next/server";
import { exportEnvironments } from "@/lib/environments/service";
import { envRoute } from "@/lib/environments/routeHelpers";
import { toCsv } from "@/lib/csv";

type RouteParams = { params: Promise<{ id: string }> };

/** `?format=json` (default) or `?format=csv`. Environments and links only: test accounts are never exported. */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return envRoute(request, id, "view", "GET environments export", async () => {
    const data = await exportEnvironments(id);
    if (request.nextUrl.searchParams.get("format") === "csv") {
      const rows = data.flatMap((e) => {
        const base = [e.name, e.status, e.isProduction ? "yes" : "no", e.appUrl, e.apiUrl, e.healthUrl, e.hosting, e.databaseSet, e.version];
        return e.links.length === 0 ? [[...base, "", "", ""]] : e.links.map((l) => [...base, l.group, l.label, l.url]);
      });
      const csv = toCsv(
        ["Environment", "Status", "Production", "App URL", "API URL", "Health URL", "Hosting", "Database set", "Version", "Link group", "Link label", "Link URL"],
        rows,
      );
      return new NextResponse(csv, {
        headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="environments.csv"' },
      });
    }
    return new NextResponse(JSON.stringify({ environments: data }, null, 2), {
      headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="environments.json"' },
    });
  });
}
