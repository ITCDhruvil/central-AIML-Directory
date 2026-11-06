// Paragraph formatting that Markdown can't hold (alignment, text direction, line spacing, indent) is saved as one HTML
// wrapper around the block, with a fixed attribute order and fixed allowed values:
//   <div align="center" dir="rtl" data-ls="1.5" data-ind="2"> ...block... </div>
// The editor writes it, and the Markdown views read it back through lib/remarkHtmlWrappers.ts. Pure (no DOM).

export const ALIGNMENTS = ["left", "center", "right", "justify"] as const;
export type Alignment = (typeof ALIGNMENTS)[number];
export const LINE_HEIGHTS = ["1", "1.15", "1.5", "2"] as const;
export type LineHeight = (typeof LINE_HEIGHTS)[number];
export const MAX_INDENT = 6;

export type BlockFormat = { align?: Exclude<Alignment, "left">; dir?: "rtl"; lineHeight?: LineHeight; indent?: number };

export const isAlignment = (v: unknown): v is Alignment => typeof v === "string" && (ALIGNMENTS as readonly string[]).includes(v);
export const isLineHeight = (v: unknown): v is LineHeight => typeof v === "string" && (LINE_HEIGHTS as readonly string[]).includes(v);

/** The opening tag for a format, or null when everything is the default (no wrapper needed). */
export function openTag(f: BlockFormat): string | null {
  const parts: string[] = [];
  if (f.align) parts.push(`align="${f.align}"`);
  if (f.dir) parts.push(`dir="rtl"`);
  if (f.lineHeight) parts.push(`data-ls="${f.lineHeight}"`);
  if (f.indent && f.indent >= 1 && f.indent <= MAX_INDENT) parts.push(`data-ind="${Math.round(f.indent)}"`);
  return parts.length ? `<div ${parts.join(" ")}>` : null;
}

const OPEN = /^<div(?: align="(left|center|right|justify)")?(?: dir="(rtl)")?(?: data-ls="(1|1\.15|1\.5|2)")?(?: data-ind="([1-6])")?>$/;

/** Reads an opening tag written by openTag; anything else (extra attributes, other values) is refused. */
export function parseOpenTag(tag: string): BlockFormat | null {
  const m = OPEN.exec(tag.trim());
  if (!m || (!m[1] && !m[2] && !m[3] && !m[4])) return null;
  const out: BlockFormat = {};
  if (m[1] && m[1] !== "left") out.align = m[1] as BlockFormat["align"];
  if (m[2]) out.dir = "rtl";
  if (m[3]) out.lineHeight = m[3] as LineHeight;
  if (m[4]) out.indent = Number(m[4]);
  return out;
}

/** The same format as inline CSS. */
export function blockStyle(f: BlockFormat): string {
  const css: string[] = [];
  if (f.align) css.push(`text-align:${f.align}`);
  if (f.lineHeight) css.push(`line-height:${f.lineHeight}`);
  if (f.indent) css.push(`margin-inline-start:${f.indent * 2}rem`);
  return css.join(";");
}
