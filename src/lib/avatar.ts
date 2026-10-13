// Browser-safe: what counts as an acceptable profile picture, and where it is served from.

/** The browser shrinks pictures to this many pixels square before uploading. */
export const AVATAR_SIZE_PX = 256;
/** A processed picture is a few tens of KB; this ceiling only stops abuse. */
export const MAX_AVATAR_BYTES = 200 * 1024;

export type AvatarType = "image/jpeg" | "image/png" | "image/webp";

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((b, i) => bytes[offset + i] === b);

/**
 * The real type of an image, read from its first bytes. The uploader's claimed type is never trusted, and anything that
 * isn't a plain JPEG, PNG or WebP (SVG, GIF, HTML dressed as an image…) is refused.
 */
export function sniffAvatarType(bytes: Uint8Array): AvatarType | null {
  if (bytes.length < 12) return null;
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  // WebP is "RIFF" + 4 size bytes + "WEBP"
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}

/** Checks an upload and returns its verified type, or what to tell the person. */
export function validateAvatar(bytes: Uint8Array): { ok: true; type: AvatarType } | { ok: false; error: string } {
  if (bytes.length === 0) return { ok: false, error: "Choose a picture to upload." };
  if (bytes.length > MAX_AVATAR_BYTES) {
    return { ok: false, error: `That picture is too large (limit ${Math.round(MAX_AVATAR_BYTES / 1024)} KB after resizing).` };
  }
  const type = sniffAvatarType(bytes);
  if (!type) return { ok: false, error: "Use a JPEG, PNG or WebP picture." };
  return { ok: true, type };
}

/**
 * Where a person's picture is served. The version (the time it was last changed) is part of the URL so a new picture
 * shows immediately instead of the browser's cached one; null means no picture, and callers show initials instead.
 */
export function avatarUrl(userId: string, version: number | null | undefined): string | null {
  return version ? `/api/users/${encodeURIComponent(userId)}/avatar?v=${version}` : null;
}
