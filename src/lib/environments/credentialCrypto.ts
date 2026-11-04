import "server-only";
import { getAuthSecret } from "@/lib/auth/config";
import { decryptToken, encryptToken } from "@/lib/github/tokenCrypto";

// Same AES-256-GCM helper as the GitHub tokens, under its own derived key. Rotating AUTH_SECRET makes stored test
// passwords unreadable; the owner then re-enters them.
const PURPOSE = "environment-credential-encryption";

export function encryptPassword(plain: string): string {
  return encryptToken(plain, getAuthSecret(), PURPOSE);
}

export function decryptPassword(stored: string): string | null {
  return decryptToken(stored, getAuthSecret(), PURPOSE);
}
