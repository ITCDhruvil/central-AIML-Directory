import { test } from "node:test";
import assert from "node:assert/strict";
import { wrapHtmlSiblings } from "@/lib/remarkHtmlWrappers";
import { normalizeHex } from "@/components/ui/ColorMarks";

const html = (value: string) => ({ type: "html", value });
const text = (value: string) => ({ type: "text", value });

test("wraps coloured text between its span tags", () => {
  const out = wrapHtmlSiblings([text("a "), html('<span data-c="#2563EB">'), text("blue"), html("</span>"), text(" b")]);
  assert.equal(out.length, 3);
  assert.equal(out[1].type, "coloredText");
  assert.deepEqual(out[1].data?.hProperties, { className: ["tc"], style: "--c:#2563eb", "data-wrapper": "c" });
  assert.equal(out[1].children?.[0].value, "blue");
});

test("wraps aligned blocks, including nested spans inside them", () => {
  const out = wrapHtmlSiblings([html('<div align="center">'), { type: "paragraph", children: [] }, html("</div>")]);
  assert.equal(out.length, 1);
  assert.equal(out[0].data?.hProperties?.style, "text-align:center");
  assert.equal(out[0].children?.length, 1);
});

test("leaves anything else alone: other html, bad colours, unmatched tags", () => {
  const other = [html("<script>alert(1)</script>"), html('<span data-c="red">'), text("x"), html("</span>")];
  assert.deepEqual(wrapHtmlSiblings(other), other);
  const unmatched = [html('<span data-h="#ffee00">'), text("never closed")];
  assert.deepEqual(wrapHtmlSiblings(unmatched), unmatched);
  assert.equal(normalizeHex("#FFEE00"), "#ffee00");
  assert.equal(normalizeHex("url(x)"), null);
  assert.equal(normalizeHex("#fff"), null);
});
