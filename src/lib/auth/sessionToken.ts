import { SignJWT, jwtVerify } from "jose";

export type SessionPayload = { uid: string; sv: number };

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(
  payload: SessionPayload,
  secret: string,
  ttlSeconds: number = SESSION_TTL_SECONDS,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ uid: payload.uid, sv: payload.sv })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds)
    .sign(key(secret));
}

export async function verifySessionToken(token: string, secret: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: ["HS256"] });
    if (typeof payload.uid !== "string" || typeof payload.sv !== "number") return null;
    return { uid: payload.uid, sv: payload.sv };
  } catch {
    return null;
  }
}
