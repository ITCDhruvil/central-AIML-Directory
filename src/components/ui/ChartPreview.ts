import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { chartToSvg, CHART_LANG, CHART_TYPES, parseChartSpec, serializeChartSpec } from "@/lib/chartSpec";

/**
 * Shows a chart under every ```chart block and hides the block's JSON, so a note reads like a document and not code.
 * The JSON is never shown for a valid chart: the buttons switch the chart type, rebuild it from the table above with AI, or
 * remove it. A block whose JSON isn't valid stays visible so it can be fixed.
 */
export const ChartPreview = Extension.create({
  name: "chartPreview",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
                        state.doc.descendants((node, pos) => {
              if (node.type.name !== "codeBlock" || node.attrs.language !== CHART_LANG) return;
              const text = node.textContent;
              const spec = parseChartSpec(text);
              const size = node.nodeSize;
              const afterTable = state.doc.resolve(pos).nodeBefore?.type.name === "table";

              // Hide the JSON while the chart is valid and the cursor is elsewhere.
              if (spec) decorations.push(Decoration.node(pos, pos + size, { class: "chart-source" }));

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
                    for (const type of CHART_TYPES) {
                      const b = button(type === "bar" ? "Bar" : type === "line" ? "Line" : "Pie", () => {
                        const at = nodePos();
                        const node = view.state.doc.nodeAt(at);
                        if (!node || spec.type === type) return;
                        const text = serializeChartSpec({ ...spec, type });
                        view.dispatch(view.state.tr.replaceWith(at + 1, at + node.nodeSize - 1, view.state.schema.text(text)));
                      });
                      if (spec.type === type) b.className = "active";
                      actions.appendChild(b);
                    }
                    if (afterTable) {
                      actions.appendChild(
                        button("✨ Update from table", () => {
                          view.dom.dispatchEvent(new CustomEvent("chart-ai", { detail: { pos: nodePos() } }));
                        }),
                      );
                    }
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
                  { side: -1, key: `chart-${afterTable ? "t" : "n"}-${text}` },
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
