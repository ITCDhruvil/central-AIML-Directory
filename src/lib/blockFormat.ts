// Paragraph formatting that Markdown can't hold (alignment, text direction, line spacing, indent) is saved as one HTML
// wrapper around the block, with a fixed attribute order and fixed allowed values:
//   <div align="center" dir="rtl" data-ls="1.5" data-ind="2"> ...block... </div>
// The editor writes it, and the Markdown views read it back through lib/remarkHtmlWrappers.ts. Pure (no DOM).

export const ALIGNMENTS = ["left", "center", "right", "justify"] as const;
export type Alignment = (typeof ALIGNMENTS)[number];
export const LINE_HEIGHTS = ["1", "1.15", "1.5", "2"] as const;
export type LineHeight = (typeof LINE_HEIGHTS)[number];
export const MAX_INDENT = 6;

export const VARIANTS = ["title", "subtitle"] as const;
export type Variant = (typeof VARIANTS)[number];
export type BlockFormat = { align?: Exclude<Alignment, "left">; dir?: "rtl"; lineHeight?: LineHeight; indent?: number; variant?: Variant };

export const isVariant = (v: unknown): v is Variant => typeof v === "string" && (VARIANTS as readonly string[]).includes(v);

/** List styles beyond the default 1. 2. 3. and round bullets. */
export const ORDERED_LIST_TYPES = ["alpha", "ALPHA", "roman", "ROMAN", "zero", "greek", "devanagari"] as const;
export const BULLET_LIST_TYPES = ["square", "circle", "dash", "arrow", "check", "star", "diamond"] as const;
export const LIST_TYPES = [...ORDERED_LIST_TYPES, ...BULLET_LIST_TYPES] as const;
export type ListType = (typeof LIST_TYPES)[number];
export const isListType = (v: unknown): v is ListType => typeof v === "string" && (LIST_TYPES as readonly string[]).includes(v);
export const isOrderedListType = (v: unknown): boolean => typeof v === "string" && (ORDERED_LIST_TYPES as readonly string[]).includes(v);
export const LIST_CSS: Record<ListType, string> = {
  alpha: "lower-alpha",
  ALPHA: "upper-alpha",
  roman: "lower-roman",
  ROMAN: "upper-roman",
  zero: "decimal-leading-zero",
  greek: "lower-greek",
  devanagari: "devanagari",
  square: "square",
  circle: "circle",
  dash: '"–  "',
  arrow: '"→  "',
  check: '"✓  "',
  star: '"★  "',
  diamond: '"◆  "',
};

/** The wrapper around a list that has a non-default style. */
export const listOpenTag = (type: ListType) => `<div data-lt="${type}">`;
const LIST_OPEN = new RegExp(`^<div data-lt="(${LIST_TYPES.join("|")})">$`);
export function parseListTag(tag: string): ListType | null {
  const m = LIST_OPEN.exec(tag.trim());
  return m ? (m[1] as ListType) : null;
}

export const PAGE_BREAK_HTML = '<div data-pb="1"></div>';

export const isAlignment = (v: unknown): v is Alignment => typeof v === "string" && (ALIGNMENTS as readonly string[]).includes(v);
export const isLineHeight = (v: unknown): v is LineHeight => typeof v === "string" && (LINE_HEIGHTS as readonly string[]).includes(v);

/** The opening tag for a format, or null when everything is the default (no wrapper needed). */
export function openTag(f: BlockFormat): string | null {
  const parts: string[] = [];
  if (f.align) parts.push(`align="${f.align}"`);
  if (f.dir) parts.push(`dir="rtl"`);
  if (f.lineHeight) parts.push(`data-ls="${f.lineHeight}"`);
  if (f.indent && f.indent >= 1 && f.indent <= MAX_INDENT) parts.push(`data-ind="${Math.round(f.indent)}"`);
  if (f.variant) parts.push(`data-pv="${f.variant}"`);
  return parts.length ? `<div ${parts.join(" ")}>` : null;
}

const OPEN = /^<div(?: align="(left|center|right|justify)")?(?: dir="(rtl)")?(?: data-ls="(1|1\.15|1\.5|2)")?(?: data-ind="([1-6])")?(?: data-pv="(title|subtitle)")?>$/;

/** Reads an opening tag written by openTag; anything else (extra attributes, other values) is refused. */
export function parseOpenTag(tag: string): BlockFormat | null {
  const m = OPEN.exec(tag.trim());
  if (!m || (!m[1] && !m[2] && !m[3] && !m[4] && !m[5])) return null;
  const out: BlockFormat = {};
  if (m[1] && m[1] !== "left") out.align = m[1] as BlockFormat["align"];
  if (m[2]) out.dir = "rtl";
  if (m[3]) out.lineHeight = m[3] as LineHeight;
  if (m[4]) out.indent = Number(m[4]);
  if (m[5]) out.variant = m[5] as Variant;
  return out;
}

/** The same format as inline CSS. */
export function blockStyle(f: BlockFormat): string {
  const css: string[] = [];
  if (f.align) css.push(`text-align:${f.align}`);
  if (f.lineHeight) css.push(`line-height:${f.lineHeight}`);
  if (f.indent) css.push(`margin-inline-start:${f.indent * 2}rem`);
  if (f.variant === "title") css.push("font-size:2rem;font-weight:700;line-height:1.2");
  if (f.variant === "subtitle") css.push("font-size:1.25rem;line-height:1.35;opacity:0.7");
  return css.join(";");
}
