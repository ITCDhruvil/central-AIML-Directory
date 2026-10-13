import { NextRequest, NextResponse } from "next/server";
import { apiAuthorize } from "@/lib/auth/dal";
import { getProjectTableColumns, setProjectTableColumns } from "@/lib/projectTableSettings";

export async function GET() {
  const auth = await apiAuthorize("projects", "view");
  if (!auth.ok) return auth.response;
  return NextResponse.json({ columns: await getProjectTableColumns() });
}

/** Admin-only: sets which columns the projects table shows, and in what order. Body: { columns: ["name", "status", …] }. */
export async function PUT(request: NextRequest) {
  const auth = await apiAuthorize("settings", "edit");
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const columns = typeof body === "object" && body !== null ? (body as Record<string, unknown>).columns : null;
  if (!Array.isArray(columns)) {
    return NextResponse.json({ error: "columns must be a list of column ids." }, { status: 400 });
  }
  return NextResponse.json({ columns: await setProjectTableColumns(columns) });
}
