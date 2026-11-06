import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { chartToSvg, CHART_LANG, parseChartSpec } from "@/lib/chartSpec";

/**
 * Shows a live chart under every ```chart block in the editor. The block itself stays an ordinary, editable code block
 * (its JSON is the chart's data); this only adds a read-only preview after it, redrawn as the JSON changes.
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
              decorations.push(
                Decoration.widget(
                  pos + node.nodeSize,
                  () => {
                    const box = document.createElement("div");
                    box.className = "chart-preview";
                    box.contentEditable = "false";
                    // The SVG is built by chartToSvg, which escapes every piece of text, so this is safe to inject.
                    box.innerHTML = spec ? chartToSvg(spec) : '<p class="chart-preview-error">This chart\'s data isn\'t valid JSON yet, so it can\'t be drawn.</p>';
                    return box;
                  },
                  { side: -1, key: `chart-${text}` },
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
