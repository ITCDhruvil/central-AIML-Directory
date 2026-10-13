import { NextRequest, NextResponse } from "next/server";
import { createRateLimiter } from "@/lib/auth/rateLimit";
import { requestPasswordReset } from "@/lib/passwordResets";

// Every request counts, since this endpoint is public. Generous for a real person, tight for scripts.
const ipLimiter = createRateLimiter({ max: 10, windowMs: 60 * 60_000 });

const SAME_ANSWER = {
  ok: true,
  message: "If that account exists, an administrator has been notified and will send you a temporary password.",
};

/**
 * Public. Always answers the same way whether or not the account exists, so it can't be used to find out who has an
 * account. The request is stored for admins (see passwordResets.ts).
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const username = typeof body === "object" && body !== null ? (body as Record<string, unknown>).username : "";
  if (typeof username !== "string" || !username.trim()) {
    return NextResponse.json({ error: "Enter your username." }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = ipLimiter.check(ip);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  try {
    await requestPasswordReset(username);
  } catch (error) {
    // Log it, but never let a failure change the answer the caller sees.
    console.error("POST /api/auth/forgot failed", error);
  }
  return NextResponse.json(SAME_ANSWER);
}
