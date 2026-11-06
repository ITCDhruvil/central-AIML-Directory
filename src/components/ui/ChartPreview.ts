import { Extension } from "@tiptap/core";
import { Plugin, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { chartToSvg, CHART_LANG, parseChartSpec } from "@/lib/chartSpec";

/**
 * Shows a chart under every ```chart block and hides the block's JSON, so a note reads like a document and not code.
 * "Edit data" reveals the JSON for editing (it hides again when the cursor leaves it); "Remove" deletes the chart. A
 * block whose JSON isn't valid yet stays visible so it can be fixed.
 */
export const ChartPreview = Extension.create({
  name: "chartPreview",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            const { from, to } = state.selection;
            state.doc.descendants((node, pos) => {
              if (node.type.name !== "codeBlock" || node.attrs.language !== CHART_LANG) return;
              const text = node.textContent;
              const spec = parseChartSpec(text);
              const size = node.nodeSize;
              const editing = from >= pos && to <= pos + size;

              // Hide the JSON while the chart is valid and the cursor is elsewhere.
              if (spec) decorations.push(Decoration.node(pos, pos + size, { class: editing ? "chart-source chart-editing" : "chart-source" }));

              decorations.push(
                Decoration.widget(
                  pos + size,
                  (view, getPos) => {
                    const box = document.createElement("div");
                    box.className = "chart-preview";
                    box.contentEditable = "false";

                    if (!spec) {
                      box.innerHTML = '<p class="chart-preview-error">This chart\'s data isn\'t valid JSON yet, so it can\'t be drawn.</p>';
                      return box;
                    }

                    // The SVG is built by chartToSvg, which escapes every piece of text, so this is safe to inject.
                    const figure = document.createElement("div");
                    figure.innerHTML = chartToSvg(spec);
                    box.appendChild(figure);

                    const actions = document.createElement("div");
                    actions.className = "chart-actions";
                    const nodePos = () => (getPos() ?? pos + size) - size;
                    const button = (label: string, run: () => void) => {
                      const b = document.createElement("button");
                      b.type = "button";
                      b.textContent = label;
                      b.addEventListener("mousedown", (e) => {
                        e.preventDefault();
                        run();
                      });
                      return b;
                    };
                    actions.appendChild(
                      button(editing ? "Editing data" : "Edit data", () => {
                        const at = nodePos();
                        view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, at + 1)).scrollIntoView());
                        view.focus();
                      }),
                    );
                    actions.appendChild(
                      button("Remove chart", () => {
                        const at = nodePos();
                        view.dispatch(view.state.tr.delete(at, at + size));
                        view.focus();
                      }),
                    );
                    box.appendChild(actions);
                    return box;
                  },
                  { side: -1, key: `chart-${editing ? "e" : "v"}-${text}` },
                ),
              );
              return false;
            });
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});
