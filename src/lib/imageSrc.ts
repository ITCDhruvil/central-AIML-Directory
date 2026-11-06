// Markdown has no image size, alignment or crop, so they ride in the link's #fragment, which the server ignores:
//   /api/media/abc#w=320&a=c&c=0.1,0.2,0.5,0.6
// w = width in px, a = l | c | r, c = crop box as fractions of the image (x, y, width, height).
// Pure (no DOM) so the editor, the Markdown renderer and the tests share it.

export type ImageAlign = "l" | "c" | "r";
export type ImageCrop = { x: number; y: number; w: number; h: number };
export type ImageOpts = { w?: number; a?: ImageAlign; c?: ImageCrop };

const round = (n: number) => Math.round(n * 1000) / 1000;

export function parseImageSrc(src: string): { base: string; opts: ImageOpts } {
  const hash = src.indexOf("#");
  if (hash < 0) return { base: src, opts: {} };
  const base = src.slice(0, hash);
  const opts: ImageOpts = {};
  for (const part of src.slice(hash + 1).split("&")) {
    const [k, v = ""] = part.split("=");
    if (k === "w") {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 20 && n <= 4000) opts.w = Math.round(n);
    } else if (k === "a" && (v === "l" || v === "c" || v === "r")) {
      opts.a = v;
    } else if (k === "c") {
      const [x, y, w, h] = v.split(",").map(Number);
      if ([x, y, w, h].every(Number.isFinite) && x >= 0 && y >= 0 && w > 0.02 && h > 0.02 && x + w <= 1.001 && y + h <= 1.001) {
        opts.c = { x, y, w, h };
      }
    }
  }
  return { base, opts };
}

export function buildImageSrc(base: string, opts: ImageOpts): string {
  const parts: string[] = [];
  if (opts.w) parts.push(`w=${Math.round(opts.w)}`);
  if (opts.a && opts.a !== "l") parts.push(`a=${opts.a}`);
  if (opts.c) parts.push(`c=${[opts.c.x, opts.c.y, opts.c.w, opts.c.h].map(round).join(",")}`);
  return parts.length ? `${base}#${parts.join("&")}` : base;
}
