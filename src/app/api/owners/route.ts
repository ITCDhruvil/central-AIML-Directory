import { NextRequest, NextResponse } from "next/server";
import { createOwner, listOwners } from "@/lib/owners";

export async function GET() {
  try {
    const owners = await listOwners();
    return NextResponse.json({ owners });
  } catch (error) {
    console.error("GET /api/owners failed", error);
    return NextResponse.json({ error: "Failed to load owners" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof body === "object" && body !== null && typeof (body as { name?: unknown }).name === "string"
    ? (body as { name: string }).name
    : "";

  if (!name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const owner = await createOwner(name);
    return NextResponse.json({ owner }, { status: 201 });
  } catch (error) {
    console.error("POST /api/owners failed", error);
    return NextResponse.json({ error: "Failed to create owner" }, { status: 500 });
  }
}
