import { Extension, type Editor } from "@tiptap/core";
import { Fragment, type Node as PMNode } from "@tiptap/pm/model";
import { Plugin, TextSelection } from "@tiptap/pm/state";
import { TableMap, cellAround } from "@tiptap/pm/tables";
import type { EditorView } from "@tiptap/pm/view";
import { parseNumber } from "@/lib/chartSpec";
import { toCsv } from "@/lib/csv";

// Table operations that ProseMirror's table package doesn't ship: move/duplicate a row, sort by a column, fit column
// widths to their content (also on a double-click of a column border, like a spreadsheet), and export as CSV.

export type TableCtx = { table: PMNode; tablePos: number; rowIndex: number; colIndex: number };

/** The table the cursor is in, with the cursor's row and column index. */
export function tableContext(editor: Editor): TableCtx | null {
  const { $from } = editor.state.selection;
  let rowIndex = -1;
  let colIndex = -1;
  for (let d = $from.depth; d > 0; d -= 1) {
    const name = $from.node(d).type.name;
    if (name === "tableCell" || name === "tableHeader") colIndex = $from.index(d - 1);
    else if (name === "tableRow") rowIndex = $from.index(d - 1);
    else if (name === "table") return { table: $from.node(d), tablePos: $from.before(d), rowIndex, colIndex };
  }
  return null;
}

const rowsOf = (table: PMNode): PMNode[] => {
  const out: PMNode[] = [];
  table.forEach((row) => out.push(row));
  return out;
};

const hasHeaderRow = (table: PMNode) => table.firstChild?.firstChild?.type.name === "tableHeader";

/** Replaces all rows of the table and puts the cursor back in the same column of `focusRow`. */
function replaceRows(editor: Editor, ctx: TableCtx, rows: PMNode[], focusRow: number) {
  const { tr } = editor.state;
  tr.replaceWith(ctx.tablePos + 1, ctx.tablePos + ctx.table.nodeSize - 1, Fragment.fromArray(rows));
  const table = tr.doc.nodeAt(ctx.tablePos);
  if (table && focusRow >= 0 && focusRow < table.childCount) {
    let pos = ctx.tablePos + 1;
    for (let i = 0; i < focusRow; i += 1) pos += table.child(i).nodeSize;
    const row = table.child(focusRow);
    let cell = pos + 1;
    for (let j = 0; j < Math.min(Math.max(ctx.colIndex, 0), row.childCount - 1); j += 1) cell += row.child(j).nodeSize;
    tr.setSelection(TextSelection.near(tr.doc.resolve(cell + 1)));
  }
  editor.view.dispatch(tr.scrollIntoView());
}

export function moveRow(editor: Editor, dir: -1 | 1) {
  const ctx = tableContext(editor);
  if (!ctx || ctx.rowIndex < 0) return;
  const rows = rowsOf(ctx.table);
  const first = hasHeaderRow(ctx.table) ? 1 : 0; // the header row stays on top
  const from = ctx.rowIndex;
  const to = from + dir;
  if (from < first || to < first || to >= rows.length) return;
  [rows[from], rows[to]] = [rows[to], rows[from]];
  replaceRows(editor, ctx, rows, to);
}

export function duplicateRow(editor: Editor) {
  const ctx = tableContext(editor);
  if (!ctx || ctx.rowIndex < 0) return;
  if (ctx.rowIndex < (hasHeaderRow(ctx.table) ? 1 : 0)) return;
  const rows = rowsOf(ctx.table);
  rows.splice(ctx.rowIndex + 1, 0, rows[ctx.rowIndex]);
  replaceRows(editor, ctx, rows, ctx.rowIndex + 1);
}

/** Sorts the body rows by the cursor's column: numerically when the column is all numbers, otherwise as text. */
export function sortByColumn(editor: Editor, dir: 1 | -1) {
  const ctx = tableContext(editor);
  if (!ctx || ctx.colIndex < 0) return;
  const rows = rowsOf(ctx.table);
  const first = hasHeaderRow(ctx.table) ? 1 : 0;
  const body = rows.slice(first);
  if (body.length < 2) return;
  const keys = body.map((r) => r.maybeChild(ctx.colIndex)?.textContent.trim() ?? "");
  const nums = keys.map(parseNumber);
  const numeric = nums.every((n, i) => n !== null || keys[i] === "");
  const order = body
    .map((_, i) => i)
    .sort((a, b) =>
      numeric ? (nums[a] ?? -Infinity) - (nums[b] ?? -Infinity) : keys[a].localeCompare(keys[b], undefined, { numeric: true, sensitivity: "base" }),
    );
  if (dir < 0) order.reverse();
  replaceRows(editor, ctx, [...rows.slice(0, first), ...order.map((i) => body[i])], Math.min(ctx.rowIndex, rows.length - 1));
}

export function exportCsv(editor: Editor) {
  const ctx = tableContext(editor);
  if (!ctx) return;
  const rows: string[][] = [];
  ctx.table.forEach((row) => {
    const cells: string[] = [];
    row.forEach((cell) => cells.push(cell.textContent.trim()));
    rows.push(cells);
  });
  const [header, ...body] = rows;
  // A leading BOM makes Excel read the file as UTF-8.
  const blob = new Blob(["﻿", toCsv(header ?? [], body)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "table.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------------------------------------------
// Column widths
// ---------------------------------------------------------------------------------------------------------------

const MIN_COL = 56;
const MAX_COL = 520;

/** How wide a cell's content wants to be on one line, including the cell's padding. */
function measureCell(cell: HTMLElement): number {
  const cs = getComputedStyle(cell);
  const probe = document.createElement("div");
  probe.style.cssText = `position:absolute;visibility:hidden;left:-9999px;top:0;white-space:nowrap;padding:0;font:${cs.font};letter-spacing:${cs.letterSpacing};`;
  probe.innerHTML = cell.innerHTML;
  document.body.appendChild(probe);
  const width = probe.scrollWidth;
  probe.remove();
  return Math.ceil(width + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + 2);
}

function setColumnWidths(view: EditorView, tableStart: number, table: PMNode, columns: number[], mode: "content" | "even") {
  const map = TableMap.get(table);
  const tr = view.state.tr;
  let even = 0;
  if (mode === "even") {
    const dom = view.nodeDOM(tableStart - 1) as HTMLElement | null;
    const total = dom?.closest(".tableWrapper")?.clientWidth ?? dom?.clientWidth ?? 600;
    even = Math.max(MIN_COL, Math.floor(total / map.width));
  }
  for (const col of columns) {
    const cells = map.cellsInRect({ left: col, right: col + 1, top: 0, bottom: map.height });
    let width = mode === "even" ? even : MIN_COL;
    if (mode === "content") {
      for (const offset of cells) {
        const dom = view.nodeDOM(tableStart + offset) as HTMLElement | null;
        if (dom) width = Math.max(width, measureCell(dom));
      }
    }
    width = Math.min(width, MAX_COL);
    for (const offset of cells) {
      const node = table.nodeAt(offset);
      if (!node || (node.attrs.colspan ?? 1) !== 1) continue;
      tr.setNodeMarkup(tableStart + offset, undefined, { ...node.attrs, colwidth: [width] });
    }
  }
  view.dispatch(tr);
}

/** Fit every column to its content, or make them all the same width. */
export function fitAllColumns(editor: Editor, mode: "content" | "even") {
  const ctx = tableContext(editor);
  if (!ctx) return;
  const width = TableMap.get(ctx.table).width;
  setColumnWidths(editor.view, ctx.tablePos + 1, ctx.table, Array.from({ length: width }, (_, i) => i), mode);
}

/** Double-click a column border to fit that column to its content, like a spreadsheet. */
export const TableAutoFit = Extension.create({
  name: "tableAutoFit",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleDOMEvents: {
            dblclick(view, event) {
              const target = event.target as HTMLElement | null;
              const cell = target?.closest("td, th") as HTMLElement | null;
              if (!cell) return false;
              const rect = cell.getBoundingClientRect();
              const edge = 7;
              // Near the right border of this cell, or the left border (which is the previous column's right border).
              const column = rect.right - event.clientX <= edge ? cell : event.clientX - rect.left <= edge ? (cell.previousElementSibling as HTMLElement | null) : null;
              if (!column) return false;
              const found = cellAround(view.state.doc.resolve(view.posAtDOM(column, 0)));
              if (!found || !found.nodeAfter) return false;
              const table = found.node(-1);
              const start = found.start(-1);
              const map = TableMap.get(table);
              const col = map.colCount(found.pos - start) + (found.nodeAfter.attrs.colspan ?? 1) - 1;
              setColumnWidths(view, start, table, [col], "content");
              event.preventDefault();
              return true;
            },
          },
        },
      }),
    ];
  },
});
