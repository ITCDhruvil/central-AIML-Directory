// Charts in notes and documents are stored as a fenced ```chart block holding a small JSON spec, so they survive the
// editor's Markdown round trip and stay editable as plain text. This file is pure (no DOM, no React): it parses and
// validates a spec, builds one from a table, and draws it as an SVG string that both the editor preview and the
// Markdown renderer use. Every piece of text is escaped, so a spec can never inject markup.

export const CHART_LANG = "chart";
export const CHART_TYPES = ["bar", "line", "pie"] as const;
export type ChartType = (typeof CHART_TYPES)[number];
export type ChartSeries = { name: string; data: number[] };
export type ChartSpec = { type: ChartType; title?: string; labels: string[]; series: ChartSeries[] };

const MAX_LABELS = 60;
const MAX_SERIES = 8;

// ---------------------------------------------------------------------------------------------------------------
// Parsing and building
// ---------------------------------------------------------------------------------------------------------------

/** A number as people write it in a table cell: "1,234", "$5.50", "12%", "(300)" for -300. Null when it isn't one. */
export function parseNumber(cell: string): number | null {
  let t = cell.trim();
  if (!t) return null;
  let negative = false;
  if (/^\(.*\)$/.test(t)) {
    negative = true;
    t = t.slice(1, -1);
  }
  t = t.replace(/[,\s]/g, "").replace(/^([-+]?)[$€£₹¥]/, "$1").replace(/%$/, "");
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/** Validates the JSON inside a ```chart block. Returns null for anything that isn't a usable spec. */
export function parseChartSpec(text: string): ChartSpec | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text.trim());
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const type = typeof o.type === "string" && (CHART_TYPES as readonly string[]).includes(o.type) ? (o.type as ChartType) : null;
  if (!type || !Array.isArray(o.labels) || !Array.isArray(o.series)) return null;

  const labels = o.labels.slice(0, MAX_LABELS).map((l) => String(l ?? "").slice(0, 80));
  if (labels.length === 0) return null;

  const series: ChartSeries[] = [];
  for (const item of o.series.slice(0, MAX_SERIES)) {
    if (typeof item !== "object" || item === null) return null;
    const s = item as Record<string, unknown>;
    if (!Array.isArray(s.data)) return null;
    const data = labels.map((_, i) => {
      const v = Number((s.data as unknown[])[i]);
      return Number.isFinite(v) ? v : 0;
    });
    series.push({ name: String(s.name ?? `Series ${series.length + 1}`).slice(0, 60), data });
  }
  if (series.length === 0) return null;

  const title = typeof o.title === "string" ? o.title.trim().slice(0, 120) : "";
  return { type, ...(title ? { title } : {}), labels, series };
}

/** The spec as readable, hand-editable JSON (one line per field) for the ```chart block. */
export function serializeChartSpec(spec: ChartSpec): string {
  const lines = ["{", `  "type": ${JSON.stringify(spec.type)},`];
  if (spec.title) lines.push(`  "title": ${JSON.stringify(spec.title)},`);
  lines.push(`  "labels": ${JSON.stringify(spec.labels)},`, `  "series": [`);
  spec.series.forEach((s, i) => {
    lines.push(`    { "name": ${JSON.stringify(s.name)}, "data": ${JSON.stringify(s.data)} }${i < spec.series.length - 1 ? "," : ""}`);
  });
  lines.push("  ]", "}");
  return lines.join("\n");
}

/**
 * Builds a chart from table rows: the first column holds the labels, every later column that is mostly numbers
 * becomes a series (named by its header cell). `hasHeader` says whether the first row is a header.
 */
export function tableToChartSpec(
  rows: string[][],
  type: ChartType,
  hasHeader: boolean,
): { ok: true; spec: ChartSpec } | { ok: false; error: string } {
  const header = hasHeader ? rows[0] : null;
  const body = hasHeader ? rows.slice(1) : rows;
  if (body.length === 0) return { ok: false, error: "The table has no data rows to chart." };

  const columns = Math.max(...rows.map((r) => r.length));
  const labels = body.map((r, i) => (r[0] ?? "").trim() || `Row ${i + 1}`);
  const series: ChartSeries[] = [];
  for (let c = 1; c < columns; c += 1) {
    const parsed = body.map((r) => parseNumber(r[c] ?? ""));
    const numeric = parsed.filter((v) => v !== null).length;
    // A column of mostly text (notes, names) isn't a series.
    if (numeric === 0 || numeric < body.length / 2) continue;
    series.push({ name: (header?.[c] ?? "").trim() || `Series ${series.length + 1}`, data: parsed.map((v) => v ?? 0) });
  }
  if (series.length === 0) {
    return { ok: false, error: "No numeric columns found. Put the numbers in the columns after the first one." };
  }

  const kept = (type === "pie" ? series.slice(0, 1) : series.slice(0, MAX_SERIES)).map((s) => ({ ...s, data: s.data.slice(0, MAX_LABELS) }));
  return { ok: true, spec: { type, labels: labels.slice(0, MAX_LABELS), series: kept } };
}

// ---------------------------------------------------------------------------------------------------------------
// Drawing (SVG string)
// ---------------------------------------------------------------------------------------------------------------

const W = 640;
const H = 320;
const COLORS = ["#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899", "#eab308", "#06b6d4", "#64748b"];
const FONT = 'font-family="system-ui, -apple-system, Segoe UI, sans-serif"';

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const round = (n: number) => Math.round(n * 100) / 100;
const num = (n: number) => String(round(n));

/** 1,200 -> "1.2K", 3,400,000 -> "3.4M"; small numbers keep up to two decimals. */
export function formatNumber(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return `${round(n / 1e9)}B`;
  if (a >= 1e6) return `${round(n / 1e6)}M`;
  if (a >= 1e4) return `${round(n / 1e3)}K`;
  return String(round(n));
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function niceStep(raw: number): number {
  const exp = Math.floor(Math.log10(raw));
  const f = raw / 10 ** exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nice * 10 ** exp;
}

/** Evenly spaced round-number ticks covering [lo, hi]. */
function ticks(lo: number, hi: number): number[] {
  const top = hi === lo ? lo + 1 : hi;
  const step = niceStep((top - lo) / 4);
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(top / step) * step;
  const out: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

function legendRows(names: string[], width: number): string[][] {
  const rows: string[][] = [[]];
  let used = 0;
  for (const name of names) {
    const w = Math.min(name.length, 18) * 6.4 + 26;
    if (used + w > width && rows[rows.length - 1].length > 0) {
      rows.push([]);
      used = 0;
    }
    rows[rows.length - 1].push(name);
    used += w;
  }
  return rows;
}

function svgOpen(spec: ChartSpec): string {
  const label = spec.title ? spec.title : `${spec.type} chart`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}" style="width:100%;height:auto;max-width:720px;display:block" ${FONT}>`;
}

function titleEl(spec: ChartSpec): string {
  return spec.title ? `<text x="${W / 2}" y="22" text-anchor="middle" font-size="14" font-weight="600" fill="currentColor">${esc(truncate(spec.title, 70))}</text>` : "";
}

function axisChart(spec: ChartSpec): string {
  const left = 54;
  const right = 16;
  const top = spec.title ? 40 : 16;
  const n = spec.labels.length;
  const rotate = n > 8 || spec.labels.some((l) => l.length > 9);
  const legend = spec.series.length > 1 ? legendRows(spec.series.map((s) => s.name), W - left - right) : [];
  const legendH = legend.length ? legend.length * 18 + 6 : 0;
  const bottom = (rotate ? 58 : 30) + legendH;
  const plotW = W - left - right;
  const plotH = Math.max(80, H - top - bottom);

  const all = spec.series.flatMap((s) => s.data);
  const t = ticks(Math.min(0, ...all), Math.max(0, ...all));
  const ymin = t[0];
  const ymax = t[t.length - 1];
  const y = (v: number) => top + plotH - ((v - ymin) / (ymax - ymin || 1)) * plotH;
  const gw = plotW / n;

  let out = svgOpen(spec) + titleEl(spec);

  for (const tick of t) {
    const ty = round(y(tick));
    out += `<line x1="${left}" x2="${W - right}" y1="${ty}" y2="${ty}" stroke="currentColor" stroke-opacity="${tick === 0 ? 0.35 : 0.12}"/>`;
    out += `<text x="${left - 8}" y="${ty + 4}" text-anchor="end" font-size="11" fill="currentColor" fill-opacity="0.7">${esc(formatNumber(tick))}</text>`;
  }

  // X labels (every k-th one when there are many).
  const every = n > 24 ? Math.ceil(n / 24) : 1;
  spec.labels.forEach((label, i) => {
    if (i % every !== 0) return;
    const cx = round(left + gw * (i + 0.5));
    const ly = top + plotH + 16;
    const text = esc(truncate(label, 12));
    out += rotate
      ? `<text transform="translate(${cx} ${ly}) rotate(-35)" text-anchor="end" font-size="11" fill="currentColor" fill-opacity="0.8"><title>${esc(label)}</title>${text}</text>`
      : `<text x="${cx}" y="${ly}" text-anchor="middle" font-size="11" fill="currentColor" fill-opacity="0.8"><title>${esc(label)}</title>${text}</text>`;
  });

  if (spec.type === "bar") {
    const barW = (gw * 0.7) / spec.series.length;
    const showValues = spec.series.length === 1 && n <= 12;
    spec.series.forEach((s, si) => {
      s.data.forEach((v, i) => {
        const x = round(left + gw * i + gw * 0.15 + si * barW);
        const y0 = y(0);
        const yv = y(v);
        const h = Math.max(0.5, Math.abs(yv - y0));
        const ry = v >= 0 ? yv : y0;
        out += `<rect x="${x}" y="${round(ry)}" width="${round(Math.max(1, barW - 2))}" height="${round(h)}" rx="2" fill="${COLORS[si % COLORS.length]}"><title>${esc(spec.labels[i])} · ${esc(s.name)}: ${num(v)}</title></rect>`;
        if (showValues) {
          const ty = v >= 0 ? yv - 5 : yv + 13;
          out += `<text x="${round(x + (barW - 2) / 2)}" y="${round(ty)}" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">${esc(formatNumber(v))}</text>`;
        }
      });
    });
  } else {
    spec.series.forEach((s, si) => {
      const color = COLORS[si % COLORS.length];
      const pts = s.data.map((v, i) => `${round(left + gw * (i + 0.5))},${round(y(v))}`);
      out += `<polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="2.25" stroke-linejoin="round" stroke-linecap="round"/>`;
      s.data.forEach((v, i) => {
        out += `<circle cx="${round(left + gw * (i + 0.5))}" cy="${round(y(v))}" r="3.25" fill="${color}"><title>${esc(spec.labels[i])} · ${esc(s.name)}: ${num(v)}</title></circle>`;
      });
    });
  }

  // Legend (multiple series only), under the x labels.
  legend.forEach((row, ri) => {
    let lx = left;
    const ly = H - legendH + ri * 18 + 12;
    for (const name of row) {
      const idx = spec.series.findIndex((s) => s.name === name);
      out += `<rect x="${lx}" y="${ly - 9}" width="10" height="10" rx="2" fill="${COLORS[Math.max(0, idx) % COLORS.length]}"/>`;
      out += `<text x="${lx + 15}" y="${ly}" font-size="11" fill="currentColor" fill-opacity="0.85">${esc(truncate(name, 18))}</text>`;
      lx += Math.min(name.length, 18) * 6.4 + 26;
    }
  });

  return `${out}</svg>`;
}

function arc(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const end = Math.min(a1, a0 + Math.PI * 2 - 0.0001);
  const large = end - a0 > Math.PI ? 1 : 0;
  const p = (r: number, a: number) => `${round(cx + r * Math.cos(a))} ${round(cy + r * Math.sin(a))}`;
  return `M ${p(r1, a0)} A ${r1} ${r1} 0 ${large} 1 ${p(r1, end)} L ${p(r0, end)} A ${r0} ${r0} 0 ${large} 0 ${p(r0, a0)} Z`;
}

function pieChart(spec: ChartSpec): string {
  const s = spec.series[0];
  const values = s.data.map((v) => Math.max(0, v));
  const total = values.reduce((a, b) => a + b, 0);
  let out = svgOpen(spec) + titleEl(spec);
  if (total <= 0) {
    return `${out}<text x="${W / 2}" y="${H / 2}" text-anchor="middle" font-size="13" fill="currentColor" fill-opacity="0.7">No positive values to chart.</text></svg>`;
  }

  const top = spec.title ? 40 : 16;
  const cx = 190;
  const cy = top + (H - top - 12) / 2;
  const r1 = Math.min(118, (H - top - 24) / 2);
  const r0 = r1 * 0.58;

  let angle = -Math.PI / 2;
  values.forEach((v, i) => {
    if (v <= 0) return;
    const sweep = (v / total) * Math.PI * 2;
    out += `<path d="${arc(cx, cy, r0, r1, angle, angle + sweep)}" fill="${COLORS[i % COLORS.length]}" stroke="var(--chart-gap, #fff)" stroke-width="1"><title>${esc(spec.labels[i])}: ${num(s.data[i])} (${round((v / total) * 100)}%)</title></path>`;
    angle += sweep;
  });

  out += `<text x="${cx}" y="${round(cy - 2)}" text-anchor="middle" font-size="18" font-weight="600" fill="currentColor">${esc(formatNumber(total))}</text>`;
  out += `<text x="${cx}" y="${round(cy + 16)}" text-anchor="middle" font-size="11" fill="currentColor" fill-opacity="0.6">Total</text>`;

  const shown = Math.min(values.length, 12);
  const rowH = Math.min(22, (H - top - 12) / Math.max(1, shown));
  const startY = top + 8;
  for (let i = 0; i < shown; i += 1) {
    const ly = startY + i * rowH + 10;
    out += `<rect x="360" y="${round(ly - 9)}" width="10" height="10" rx="2" fill="${COLORS[i % COLORS.length]}"/>`;
    out += `<text x="376" y="${round(ly)}" font-size="12" fill="currentColor" fill-opacity="0.9">${esc(truncate(spec.labels[i], 22))}</text>`;
    out += `<text x="${W - 16}" y="${round(ly)}" text-anchor="end" font-size="12" fill="currentColor" fill-opacity="0.65">${round((values[i] / total) * 100)}%</text>`;
  }
  if (values.length > shown) {
    out += `<text x="376" y="${round(startY + shown * rowH + 10)}" font-size="11" fill="currentColor" fill-opacity="0.5">+ ${values.length - shown} more</text>`;
  }
  return `${out}</svg>`;
}

/** Draws a chart spec as an SVG string. Text colour comes from `currentColor`, so it follows the surrounding theme. */
export function chartToSvg(spec: ChartSpec): string {
  return spec.type === "pie" ? pieChart(spec) : axisChart(spec);
}
