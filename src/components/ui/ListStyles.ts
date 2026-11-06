import { BulletList, OrderedList } from "@tiptap/extension-list";
import { LIST_CSS, isListType, listOpenTag, type ListType } from "@/lib/blockFormat";

// Lists with a style beyond the default: letters (a. b. c.), roman numerals (i. ii. iii.), square or circle bullets.
// A styled top-level list is saved inside <div data-lt="alpha"> … </div> (see lib/blockFormat.ts). The serializers below
// are the editor's normal ones plus that wrapper.

type SerializerState = {
  write: (s: string) => void;
  closeBlock: (node: unknown) => void;
  renderList: (node: unknown, indent: string, bullet: (i: number) => string) => void;
  repeat: (s: string, n: number) => string;
};
type ListNode = { attrs: { listType?: string | null; start?: number }; childCount: number; type: { name: string } };
type Parent = { type: { name: string }; child: (i: number) => { type: { name: string } } } | undefined;

const listTypeAttribute = {
  listType: {
    default: null,
    parseHTML: (el: HTMLElement) => {
      const wrapper = el.parentElement?.tagName === "DIV" ? el.parentElement.getAttribute("data-lt") : null;
      return isListType(wrapper) ? wrapper : null;
    },
    renderHTML: (attrs: { listType?: string | null }) => (isListType(attrs.listType) ? { style: `list-style-type:${LIST_CSS[attrs.listType as ListType]}` } : {}),
  },
};

function wrapped(state: SerializerState, node: ListNode, parent: Parent, body: () => void) {
  const type = node.attrs.listType;
  if (isListType(type) && parent?.type.name === "doc") {
    state.write(listOpenTag(type));
    state.closeBlock(node);
    body();
    state.write("</div>");
    state.closeBlock(node);
  } else {
    body();
  }
}

function adjacentIndex(node: ListNode, parent: Parent, index: number) {
  let i = 0;
  for (; index - i > 0; i += 1) {
    if (parent && parent.child(index - i - 1).type.name !== node.type.name) break;
  }
  return i;
}

export const StyledBulletList = BulletList.extend({
  addAttributes() {
    return { ...this.parent?.(), ...listTypeAttribute };
  },
  addStorage() {
    return {
      markdown: {
        serialize(this: { editor: { storage: { markdown: { options: { bulletListMarker?: string } } } } }, state: SerializerState, node: ListNode, parent: Parent) {
          const marker = this.editor.storage.markdown.options.bulletListMarker || "-";
          wrapped(state, node, parent, () => state.renderList(node, "  ", () => `${marker} `));
        },
        parse: {},
      },
    };
  },
});

export const StyledOrderedList = OrderedList.extend({
  addAttributes() {
    return { ...this.parent?.(), ...listTypeAttribute };
  },
  addStorage() {
    return {
      markdown: {
        serialize(state: SerializerState, node: ListNode, parent: Parent, index: number) {
          wrapped(state, node, parent, () => {
            const start = node.attrs.start || 1;
            const maxW = String(start + node.childCount - 1).length;
            const space = state.repeat(" ", maxW + 2);
            const separator = adjacentIndex(node, parent, index) % 2 ? ") " : ". ";
            state.renderList(node, space, (i) => {
              const n = String(start + i);
              return state.repeat(" ", maxW - n.length) + n + separator;
            });
          });
        },
        parse: {},
      },
    };
  },
});
