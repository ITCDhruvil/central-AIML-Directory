export const SESSION_COOKIE = "aiml_session";

/** Throws when AUTH_SECRET is missing or too short — fail closed rather than sign with a weak key. */
export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set to a random string of at least 32 characters");
  }
  return secret;
}
