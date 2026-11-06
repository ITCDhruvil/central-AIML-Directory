// Notes save text colour, highlight and alignment as tiny HTML wrappers (see components/ui/ColorMarks.ts):
//   <span data-c="#2563eb">…</span>   <span data-h="#fde047">…</span>   <span data-s="lg">…</span>
//   <div align="center" dir="rtl" data-ls="1.5" data-ind="2">…</div>   (see lib/blockFormat.ts)
// Raw HTML is never rendered by the Markdown views. Instead this remark plugin recognises exactly these three
// wrappers, with exactly these attribute values, and turns them into styled nodes; any other HTML is left as it was
// (and so still not shown). Pure (no DOM) so it can be tested.

import { PAGE_BREAK_HTML, blockStyle, parseListTag, parseOpenTag } from "@/lib/blockFormat";
import { parseFontSize } from "@/lib/fontSize";

type MdNode = {
  type: string;
  value?: string;
  children?: MdNode[];
  data?: { hName?: string; hProperties?: Record<string, unknown> };
};

const HEX = /^#[0-9a-f]{6}$/i;
const SPAN_OPEN = /^<span data-(c|h)="(#[0-9a-fA-F]{6})">$/;
const SIZE_OPEN = /^<span data-s="([a-z0-9]{1,2})">$/;

type Opened = { tag: "span" | "div"; props: Record<string, unknown> };

function openOf(node: MdNode): Opened | null {
  if (node.type !== "html" || typeof node.value !== "string") return null;
  const value = node.value.trim();
  const span = SPAN_OPEN.exec(value);
  if (span && HEX.test(span[2])) {
    const hex = span[2].toLowerCase();
    return { tag: "span", props: { className: [span[1] === "c" ? "tc" : "hl"], style: `--c:${hex}`, "data-wrapper": span[1] } };
  }
  const size = SIZE_OPEN.exec(value);
  const px = size ? parseFontSize(size[1]) : null;
  if (px) return { tag: "span", props: { className: ["ts"], style: `font-size:${px}px`, "data-wrapper": "s" } };
  const listType = parseListTag(value);
  if (listType) return { tag: "div", props: { className: ["lt", `lt-${listType}`] } };
  const block = parseOpenTag(value);
  if (block) {
    const props: Record<string, unknown> = { style: blockStyle(block) };
    if (block.dir) props.dir = "rtl";
    return { tag: "div", props };
  }
  return null;
}

const isClose = (node: MdNode, tag: "span" | "div") => node.type === "html" && node.value?.trim() === `</${tag}>`;

function wrap(children: MdNode[]): MdNode[] {
  const out: MdNode[] = [];
  for (let i = 0; i < children.length; i += 1) {
    if (children[i].type === "html" && children[i].value?.trim() === PAGE_BREAK_HTML) {
      out.push({ type: "pageBreak", data: { hName: "div", hProperties: { className: ["page-break"] } }, children: [] });
      continue;
    }
    const open = openOf(children[i]);
    if (!open) {
      out.push(children[i]);
      continue;
    }
    // Find the matching close tag, counting nested openings of the same tag.
    let depth = 1;
    let end = -1;
    for (let j = i + 1; j < children.length; j += 1) {
      const inner = openOf(children[j]);
      if (inner && inner.tag === open.tag) depth += 1;
      else if (isClose(children[j], open.tag)) {
        depth -= 1;
        if (depth === 0) {
          end = j;
          break;
        }
      }
    }
    if (end === -1) {
      out.push(children[i]);
      continue;
    }
    const inside = wrap(children.slice(i + 1, end));
    out.push({
      type: open.tag === "div" ? "alignedBlock" : "coloredText",
      data: { hName: open.tag, hProperties: open.props },
      children: inside,
    });
    i = end;
  }
  return out;
}

function visit(node: MdNode) {
  if (!node.children) return;
  node.children = wrap(node.children);
  node.children.forEach(visit);
}

/** remark plugin: `remarkPlugins={[remarkHtmlWrappers]}` */
export function remarkHtmlWrappers() {
  return (tree: MdNode) => {
    visit(tree);
  };
}

export { wrap as wrapHtmlSiblings };
