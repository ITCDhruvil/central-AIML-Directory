import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

// Holds the current inline AI suggestion (grey "ghost" text at the cursor), or null when there is none.
export const ghostTextKey = new PluginKey<string | null>("ghostText");

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    ghostText: {
      setGhostText: (text: string) => ReturnType;
      clearGhostText: () => ReturnType;
      acceptGhostText: () => ReturnType;
    };
  }
}

/**
 * Inline autocomplete: shows an AI continuation as grey text after the cursor. The suggestion lives in a plugin and is
 * rendered as a widget decoration; typing or moving the cursor clears it. Tab accepts it, Escape dismisses it. The
 * suggestion itself is set from React (debounced AI call) via the setGhostText command.
 */
export const GhostText = Extension.create({
  name: "ghostText",

  addProseMirrorPlugins() {
    return [
      new Plugin<string | null>({
        key: ghostTextKey,
        state: {
          init: () => null,
          apply(tr, value) {
            const meta = tr.getMeta(ghostTextKey) as string | null | undefined;
            if (meta !== undefined) return meta;
            // Any real edit or cursor move drops the suggestion.
            if (tr.docChanged || tr.selectionSet) return null;
            return value;
          },
        },
        props: {
          decorations(state) {
            const text = ghostTextKey.getState(state);
            const sel = state.selection;
            if (!text || !sel.empty) return null;
            const widget = Decoration.widget(
              sel.from,
              () => {
                const span = document.createElement("span");
                span.className = "ghost-text";
                span.textContent = text;
                return span;
              },
              { side: 1 },
            );
            return DecorationSet.create(state.doc, [widget]);
          },
        },
      }),
    ];
  },

  addCommands() {
    return {
      setGhostText:
        (text: string) =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(ghostTextKey, text));
          return true;
        },
      clearGhostText:
        () =>
        ({ tr, dispatch, state }) => {
          if (ghostTextKey.getState(state) == null) return false;
          if (dispatch) dispatch(tr.setMeta(ghostTextKey, null));
          return true;
        },
      acceptGhostText:
        () =>
        ({ editor, chain }) => {
          const text = ghostTextKey.getState(editor.state);
          if (!text) return false;
          return chain()
            .insertContent(text)
            .command(({ tr, dispatch }) => {
              if (dispatch) dispatch(tr.setMeta(ghostTextKey, null));
              return true;
            })
            .run();
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (!ghostTextKey.getState(this.editor.state)) return false;
        return this.editor.commands.acceptGhostText();
      },
      Escape: () => this.editor.commands.clearGhostText(),
    };
  },
});
