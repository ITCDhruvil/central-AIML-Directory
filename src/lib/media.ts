// Browser-safe helpers for images, video and audio added to notes. Pure (no DOM, no server imports) so the upload
// route, the editor and the Markdown renderer share one definition.

export type MediaKind = "image" | "video" | "audio";

/** Largest file accepted. Files live in the database, so this keeps one upload from swamping it. */
export const MAX_MEDIA_BYTES = 25 * 1024 * 1024;

export const MEDIA_ACCEPT: Record<MediaKind, string> = {
  image: "image/png,image/jpeg,image/gif,image/webp",
  video: "video/mp4,video/webm,video/quicktime",
  audio: "audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/webm",
};

const starts = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);
const ascii = (b: Uint8Array, at: number, len: number) => String.fromCharCode(...b.slice(at, at + len));

/**
 * The real type of an uploaded file, read from its first bytes (never from the name or the type the browser claims).
 * Only plain image, video and audio containers are accepted: no SVG or HTML, which could run script from our origin.
 * `hint` ("video" or "audio") only breaks the tie for containers that can hold either (WebM, MP4).
 */
export function sniffMedia(bytes: Uint8Array, hint?: MediaKind): { type: string; kind: MediaKind } | null {
  if (bytes.length < 12) return null;
  if (starts(bytes, [0xff, 0xd8, 0xff])) return { type: "image/jpeg", kind: "image" };
  if (starts(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { type: "image/png", kind: "image" };
  if (ascii(bytes, 0, 4) === "GIF8") return { type: "image/gif", kind: "image" };
  if (ascii(bytes, 0, 4) === "RIFF") {
    const form = ascii(bytes, 8, 4);
    if (form === "WEBP") return { type: "image/webp", kind: "image" };
    if (form === "WAVE") return { type: "audio/wav", kind: "audio" };
    return null;
  }
  if (ascii(bytes, 0, 4) === "OggS") return { type: "audio/ogg", kind: "audio" };
  if (starts(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return hint === "audio" ? { type: "audio/webm", kind: "audio" } : { type: "video/webm", kind: "video" };
  if (ascii(bytes, 4, 4) === "ftyp") {
    const brand = ascii(bytes, 8, 4);
    if (brand === "qt  ") return { type: "video/quicktime", kind: "video" };
    if (brand === "M4A " || brand === "M4B ") return { type: "audio/mp4", kind: "audio" };
    return hint === "audio" ? { type: "audio/mp4", kind: "audio" } : { type: "video/mp4", kind: "video" };
  }
  if (ascii(bytes, 0, 3) === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) return { type: "audio/mpeg", kind: "audio" };
  return null;
}

/** A file name safe to show and to put in a header or Markdown. */
export function cleanMediaName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  return base.replace(/[\u0000-\u001f\u007f[\]()<>"]/g, "").trim().slice(0, 120) || "file";
}

export const mediaUrl = (id: string) => `/api/media/${encodeURIComponent(id)}`;

/** Only our own media links and plain web addresses may be used as a media source. */
export function safeMediaSrc(raw: string): string | null {
  const t = raw.trim();
  if (/^\/api\/media\/[A-Za-z0-9_-]+$/.test(t)) return t;
  try {
    const u = new URL(t);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Markdown has no video or audio, so they are stored as an image whose description starts with the kind:
 * ![video: demo.mp4](/api/media/abc). Other Markdown viewers show a plain image link; ours shows a player.
 */
export function mediaMarkdownAlt(kind: "video" | "audio", name: string): string {
  return `${kind}: ${cleanMediaName(name)}`;
}

export function parseMediaAlt(alt: string | null | undefined): { kind: "video" | "audio"; name: string } | null {
  const m = /^(video|audio):\s?(.*)$/.exec(alt ?? "");
  return m ? { kind: m[1] as "video" | "audio", name: m[2] } : null;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${Number((n / (1024 * 1024)).toFixed(1))} MB`;
}
