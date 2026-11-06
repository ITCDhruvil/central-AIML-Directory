import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export type FindState = { query: string; caseSensitive: boolean; matches: { from: number; to: number }[]; current: number };

export const findKey = new PluginKey<FindState>("findReplace");
const EMPTY: FindState = { query: "", caseSensitive: false, matches: [], current: -1 };
const MAX_MATCHES = 2000;

function findMatches(doc: PMNode, query: string, caseSensitive: boolean) {
  const out: { from: number; to: number }[] = [];
  if (!query) return out;
  const needle = caseSensitive ? query : query.toLowerCase();
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const hay = caseSensitive ? node.text : node.text.toLowerCase();
    let at = hay.indexOf(needle);
    while (at !== -1 && out.length < MAX_MATCHES) {
      out.push({ from: pos + at, to: pos + at + needle.length });
      at = hay.indexOf(needle, at + needle.length);
    }
  });
  return out;
}

/** Highlights every match of a search text in the note, and keeps track of which one is current. */
export const FindReplace = Extension.create({
  name: "findReplace",

  addProseMirrorPlugins() {
    return [
      new Plugin<FindState>({
        key: findKey,
        state: {
          init: () => EMPTY,
          apply(tr, prev, _old, state) {
            const meta = tr.getMeta(findKey) as Partial<Pick<FindState, "query" | "caseSensitive" | "current">> | undefined;
            if (!meta && !tr.docChanged) return prev;
            const query = meta?.query ?? prev.query;
            const caseSensitive = meta?.caseSensitive ?? prev.caseSensitive;
            const matches = findMatches(state.doc, query, caseSensitive);
            let current = meta?.current ?? prev.current;
            const searchChanged = meta?.query !== undefined || meta?.caseSensitive !== undefined;
            if (searchChanged && meta?.current === undefined) current = matches.length ? 0 : -1;
            if (current >= matches.length) current = matches.length ? 0 : -1;
            if (current < 0 && matches.length) current = 0;
            return { query, caseSensitive, matches, current };
          },
        },
        props: {
          decorations(state) {
            const s = findKey.getState(state);
            if (!s || !s.query || s.matches.length === 0) return null;
            return DecorationSet.create(
              state.doc,
              s.matches.map((m, i) => Decoration.inline(m.from, m.to, { class: i === s.current ? "find-match find-current" : "find-match" })),
            );
          },
        },
      }),
    ];
  },
});

export const getFind = (editor: Editor): FindState => findKey.getState(editor.state) ?? EMPTY;

export function setFind(editor: Editor, change: Partial<Pick<FindState, "query" | "caseSensitive" | "current">>) {
  editor.view.dispatch(editor.state.tr.setMeta(findKey, change));
}

/** Scrolls the current match into view without moving the cursor or taking focus. */
export function revealCurrent(editor: Editor) {
  const s = getFind(editor);
  const m = s.matches[s.current];
  if (!m) return;
  const at = editor.view.domAtPos(m.from).node;
  (at instanceof HTMLElement ? at : at.parentElement)?.scrollIntoView({ block: "center", behavior: "smooth" });
}

export function stepFind(editor: Editor, dir: 1 | -1) {
  const s = getFind(editor);
  if (s.matches.length === 0) return;
  setFind(editor, { current: (s.current + dir + s.matches.length) % s.matches.length });
  revealCurrent(editor);
}

export function replaceCurrent(editor: Editor, text: string) {
  const s = getFind(editor);
  const m = s.matches[s.current];
  if (!m) return;
  editor.view.dispatch(editor.state.tr.insertText(text, m.from, m.to));
  revealCurrent(editor);
}

export function replaceAll(editor: Editor, text: string): number {
  const s = getFind(editor);
  if (s.matches.length === 0) return 0;
  const tr = editor.state.tr;
  // From the end backwards so earlier positions stay valid.
  for (const m of [...s.matches].reverse()) tr.insertText(text, m.from, m.to);
  editor.view.dispatch(tr);
  return s.matches.length;
}
