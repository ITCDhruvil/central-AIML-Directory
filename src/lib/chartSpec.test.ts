import { test } from "node:test";
import assert from "node:assert/strict";
import { chartToSvg, formatNumber, parseChartSpec, parseNumber, serializeChartSpec, tableToChartSpec, type ChartSpec } from "@/lib/chartSpec";

test("parses numbers as people write them in table cells", () => {
  assert.equal(parseNumber("1,234"), 1234);
  assert.equal(parseNumber("$5.50"), 5.5);
  assert.equal(parseNumber("-$5"), -5);
  assert.equal(parseNumber("12%"), 12);
  assert.equal(parseNumber("(300)"), -300);
  assert.equal(parseNumber(".5"), 0.5);
  assert.equal(parseNumber("abc"), null);
  assert.equal(parseNumber(""), null);
  assert.equal(parseNumber("12abc"), null);
});

test("builds a chart from a table: first column labels, numeric columns become series", () => {
  const rows = [
    ["Month", "Sales", "Notes", "Costs"],
    ["Jan", "100", "good", "$40"],
    ["Feb", "1,200", "ok", "$55"],
    ["Mar", "300", "", "$60"],
  ];
  const result = tableToChartSpec(rows, "bar", true);
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.deepEqual(result.spec.labels, ["Jan", "Feb", "Mar"]);
  assert.deepEqual(
    result.spec.series.map((s) => s.name),
    ["Sales", "Costs"],
  );
  assert.deepEqual(result.spec.series[0].data, [100, 1200, 300]);
});

test("a pie keeps only the first series; a table with no numbers is rejected with a clear message", () => {
  const rows = [
    ["Item", "A", "B"],
    ["x", "1", "2"],
  ];
  const pie = tableToChartSpec(rows, "pie", true);
  assert.ok(pie.ok && pie.spec.series.length === 1);

  const bad = tableToChartSpec([["Name", "Note"], ["a", "hello"]], "bar", true);
  assert.ok(!bad.ok);
  if (!bad.ok) assert.match(bad.error, /numeric/);

  assert.ok(!tableToChartSpec([["Only", "Header"]], "bar", true).ok);
});

test("validates specs and round-trips through the serialized block", () => {
  const spec: ChartSpec = { type: "line", title: "Growth", labels: ["a", "b"], series: [{ name: "S", data: [1, 2] }] };
  assert.deepEqual(parseChartSpec(serializeChartSpec(spec)), spec);
  assert.equal(parseChartSpec("not json"), null);
  assert.equal(parseChartSpec('{"type":"radar","labels":["a"],"series":[]}'), null);
  assert.equal(parseChartSpec('{"type":"bar","labels":[],"series":[{"name":"x","data":[]}]}'), null);
  // Missing or non-numeric values become 0 rather than breaking the chart.
  assert.deepEqual(parseChartSpec('{"type":"bar","labels":["a","b"],"series":[{"name":"x","data":[1,"oops"]}]}')?.series[0].data, [1, 0]);
});

test("draws bar, line and pie charts as SVG", () => {
  const base = { labels: ["Jan", "Feb", "Mar"], series: [{ name: "Sales", data: [10, 20, 15] }] };
  for (const type of ["bar", "line", "pie"] as const) {
    const svg = chartToSvg({ type, ...base });
    assert.ok(svg.startsWith("<svg"), type);
    assert.ok(svg.endsWith("</svg>"), type);
    assert.ok(svg.includes("Jan"), type);
  }
  assert.ok(chartToSvg({ type: "bar", ...base }).includes("<rect"));
  assert.ok(chartToSvg({ type: "line", ...base }).includes("<polyline"));
  assert.ok(chartToSvg({ type: "pie", ...base }).includes("<path"));
  assert.ok(chartToSvg({ type: "pie", labels: ["a"], series: [{ name: "s", data: [0] }] }).includes("No positive values"));
});

test("escapes every piece of text so a spec can never inject markup", () => {
  const svg = chartToSvg({
    type: "bar",
    title: '<script>alert(1)</script>"',
    labels: ["<img src=x onerror=alert(1)>"],
    series: [{ name: "</svg><script>", data: [1] }, { name: "b", data: [2] }],
  });
  assert.ok(!svg.includes("<script"));
  assert.ok(!svg.includes("<img"));
  assert.ok(svg.includes("&lt;script&gt;"));
});

test("formats large numbers compactly", () => {
  assert.equal(formatNumber(950), "950");
  assert.equal(formatNumber(12000), "12K");
  assert.equal(formatNumber(3400000), "3.4M");
});
