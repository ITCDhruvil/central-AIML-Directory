import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const VERSION = "v1";

// Derived from AUTH_SECRET (plus a purpose label, so each kind of secret gets its own key) so no extra secret has to be
// configured. Rotating AUTH_SECRET makes stored tokens
// undecryptable; users then simply reconnect GitHub.
function key(secret: string, purpose: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, "", purpose, 32));
}

/** AES-256-GCM. Output: `v1.<iv>.<tag>.<ciphertext>` (base64url parts). */
export function encryptToken(plain: string, secret: string, purpose = "github-token-encryption"): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret, purpose), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), data.toString("base64url")].join(".");
}

/** Returns null for anything malformed, tampered with, or encrypted under a different secret. */
export function decryptToken(stored: string, secret: string, purpose = "github-token-encryption"): string | null {
  const [version, iv, tag, data] = stored.split(".");
  if (version !== VERSION || !iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(secret, purpose), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
