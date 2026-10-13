import { audit } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createRateLimiter } from "@/lib/auth/rateLimit";
import { setSessionCookie } from "@/lib/auth/session";
import { getSecurityPolicy } from "@/lib/securityPolicySettings";

// Only failed attempts count. A single account is limited tightly; an IP loosely, since offices share one address.
// The actual numbers come from the security policy on each request; these are just the fallbacks.
const emailLimiter = createRateLimiter({ max: 8, windowMs: 15 * 60_000 });
const ipLimiter = createRateLimiter({ max: 40, windowMs: 15 * 60_000 });
const IP_LIMIT_FACTOR = 5;

// Compared against when the email is unknown so response time doesn't reveal which emails exist.
let dummyHash: Promise<string> | null = null;

const INVALID = { error: "Invalid email or password" };

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const raw = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
  const password = typeof raw.password === "string" ? raw.password : "";
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const policy = await getSecurityPolicy();
  const emailLimit = { max: policy.loginMaxFailures, windowMs: policy.loginWindowMinutes * 60_000 };
  const ipLimit = { max: policy.loginMaxFailures * IP_LIMIT_FACTOR, windowMs: emailLimit.windowMs };

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  for (const status of [ipLimiter.peek(ip, ipLimit), emailLimiter.peek(email, emailLimit)]) {
    if (!status.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Try again later." },
        { status: 429, headers: { "Retry-After": String(status.retryAfterSeconds) } },
      );
    }
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    dummyHash ??= hashPassword("dummy-password-for-timing");
    const valid = await verifyPassword(password, user?.passwordHash ?? (await dummyHash));

    if (!user || !user.active || !valid) {
      ipLimiter.check(ip, ipLimit);
      emailLimiter.check(email, emailLimit);
      await audit({
        action: "auth.login_failed",
        actorId: user?.id ?? null,
        meta: { email, reason: !user ? "unknown account" : !user.active ? "account deactivated" : "wrong password" },
        request,
      });
      return NextResponse.json(INVALID, { status: 401 });
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await setSessionCookie(user.id, user.sessionVersion, raw.remember !== false);
    emailLimiter.reset(email);
    await audit({ action: "auth.login", actorId: user.id, meta: { email, remember: raw.remember !== false }, request });
    return NextResponse.json({ ok: true, mustChangePassword: user.mustChangePassword });
  } catch (error) {
    console.error("POST /api/auth/login failed", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
