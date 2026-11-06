import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { createTemplate, listTemplates, MAX_TEMPLATE_LENGTH } from "@/lib/noteExtras";

async function me() {
  const user = await getCurrentUser();
  return user && !user.mustChangePassword ? user : null;
}

/** The signed-in person's saved note templates. */
export async function GET() {
  const user = await me();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  return NextResponse.json({ templates: await listTemplates(user.id) });
}

/** Saves a template. Body: { name, content }. */
export async function POST(request: NextRequest) {
  const user = await me();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const data = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const content = typeof data.content === "string" ? data.content : "";
  if (!name) return NextResponse.json({ error: "Give the template a name." }, { status: 400 });
  if (!content.trim()) return NextResponse.json({ error: "There is nothing to save yet." }, { status: 400 });
  if (content.length > MAX_TEMPLATE_LENGTH) return NextResponse.json({ error: "The note is too long to save as a template." }, { status: 400 });
  const created = await createTemplate(user.id, name, content);
  return "error" in created ? NextResponse.json({ error: created.error }, { status: 400 }) : NextResponse.json({ template: created });
}
