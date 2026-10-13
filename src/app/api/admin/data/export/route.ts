import { NextRequest, NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { apiAuthorize } from "@/lib/auth/dal";
import { buildExport, EXPORT_TYPES, type ExportType } from "@/lib/dataExport";

/** Downloads the directory as CSV or a JSON backup. Needs permission to edit settings; every download is logged. */
export async function GET(request: NextRequest) {
  const auth = await apiAuthorize("settings", "edit");
  if (!auth.ok) return auth.response;

  const type = request.nextUrl.searchParams.get("type") ?? "";
  if (!(EXPORT_TYPES as readonly string[]).includes(type)) {
    return NextResponse.json({ error: `type must be one of ${EXPORT_TYPES.join(", ")}` }, { status: 400 });
  }

  try {
    const file = await buildExport(type as ExportType);
    await audit({ action: "data.exported", actorId: auth.user.id, meta: { type, rows: file.count }, request });
    return new NextResponse(file.body, {
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename="${file.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/admin/data/export failed", error);
    return NextResponse.json({ error: "Failed to build the export" }, { status: 500 });
  }
}
