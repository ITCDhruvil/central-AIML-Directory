import "server-only";
import { cookies } from "next/headers";
import { getAuthSecret, SESSION_COOKIE } from "@/lib/auth/config";
import { getSecurityPolicy } from "@/lib/securityPolicySettings";
import { rememberSeconds, sessionSeconds } from "@/lib/securityPolicy";
import {
  signSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "@/lib/auth/sessionToken";

// Without "remember me" the cookie dies with the browser and the token itself expires after the policy's session
// length; with it, after the policy's remember-me length.
export async function setSessionCookie(userId: string, sessionVersion: number, remember = true): Promise<void> {
  const policy = await getSecurityPolicy();
  const ttl = remember ? rememberSeconds(policy) : sessionSeconds(policy);
  const token = await signSessionToken({ uid: userId, sv: sessionVersion }, getAuthSecret(), ttl);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(remember ? { maxAge: ttl } : {}),
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function readSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token, getAuthSecret());
}
