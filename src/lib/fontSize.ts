// Font sizes saved as <span data-s="18"> (pixels). The old words small / large / huge are still read, as 11 / 18 / 24.
// Pure (no DOM), shared by the editor mark, the Markdown renderer and the tests.

export const BASE_FONT_SIZE = 14;
export const MIN_FONT_SIZE = 8;
export const MAX_FONT_SIZE = 96;
export const FONT_SIZE_PRESETS = [8, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72] as const;

const LEGACY: Record<string, number> = { sm: 11, lg: 18, xl: 24 };

/** A saved size value ("18", or an old word) as a whole number of pixels, or null if it isn't one. */
export function parseFontSize(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  const n = text in LEGACY ? LEGACY[text] : /^\d{1,2}$/.test(text) ? Number(text) : NaN;
  return Number.isInteger(n) && n >= MIN_FONT_SIZE && n <= MAX_FONT_SIZE ? n : null;
}
