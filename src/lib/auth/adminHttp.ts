import "server-only";
import { NextResponse } from "next/server";
import { AdminError } from "@/lib/auth/adminService";

/** Parses a JSON request body; null when it isn't valid JSON. */
export async function readJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function badJson() {
  return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
}

/** Maps a service error to its HTTP response; rethrows anything unexpected. */
export function adminErrorResponse(error: unknown, label: string) {
  if (error instanceof AdminError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error(`${label} failed`, error);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
