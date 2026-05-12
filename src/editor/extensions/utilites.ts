import { Node } from "@tiptap/pm/model";

import { Fragment, Slice } from "@tiptap/pm/model";
import { Editor } from "@tiptap/react";
import { Plugin } from "prosemirror-state";

import {
  computePosition,
  offset,
  flip,
  shift,
  autoUpdate,
  type Middleware,
} from "@floating-ui/dom";
import { uniqId } from "../../utils/uniq-id";

export type FloatingCleanup = () => void;

export function createFloating(
  referenceRect: DOMRect,
  floatingEl: HTMLElement,
  middleware: Middleware[] = [offset(6), flip(), shift({ padding: 8 })],
): FloatingCleanup {
  return autoUpdate(document.body, floatingEl, async () => {
    const { x, y } = await computePosition(
      {
        getBoundingClientRect: () => referenceRect,
      },
      floatingEl,
      {
        placement: "bottom-start",
        middleware,
      },
    );

    Object.assign(floatingEl.style, {
      position: "absolute",
      left: `${x}px`,
      top: `${y}px`,
    });
  });
}

export const ensureUniqueId = (editor: Editor) => {
  const transaction = editor.state.tr;
  const seenIds = new Set<string>();
  editor.state.doc.descendants((node, pos) => {
    if (node.attrs.shouldUnique) {
      let id: string | undefined = node.attrs.id;
      if (!id || typeof id !== "string") {
        id = `${node.type.name}-${uniqId()}`;
        transaction.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          id,
        });
        seenIds.add(id);
      } else {
        if (typeof id == "string" && id.includes("-") && /^[0-9]/.test(id)) {
          const newId = `${node.type.name}:${uniqId()}`;
          transaction.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            id: newId,
          });
        }
        if (seenIds.has(id)) {
          const newId = `${node.type.name}-${uniqId()}`;
          transaction.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            id: newId,
          });
          seenIds.add(newId);
          console.warn(
            `Duplicate id found at pos ${pos}. Changed id from ${id} to ${newId}`,
          );
        } else {
          seenIds.add(id);
        }
      }
    }
  });

  if (transaction.docChanged) {
    editor.view.dispatch(transaction);
  }
};

export interface NodePasteRuleConfig {
  find: (node: Node) => boolean;
  handler: (props: { node: Node }) => Node;
}

export function NodePasteRule(config: NodePasteRuleConfig) {
  return new Plugin({
    props: {
      transformPasted(slice) {
        const fragment = mapFragment(slice.content, config);
        return new Slice(fragment, slice.openStart, slice.openEnd);
      },
    },
  });
}

const mapFragment = (fragment: Fragment, config: NodePasteRuleConfig) => {
  const children: Node[] = [];
  fragment.forEach((node) => {
    let newNode = node;
    if (config.find(node)) {
      newNode = config.handler({ node });
    }
    children.push(newNode);
  });
  return Fragment.fromArray(children);
};

export const applyHeaderGroupingClasses = (editorWrapper: HTMLElement) => {
  const tables: NodeListOf<HTMLTableElement> =
    editorWrapper.querySelectorAll("table");

  tables.forEach((table: HTMLTableElement) => {
    const rows: NodeListOf<HTMLTableRowElement> = table.querySelectorAll("tr");

    rows.forEach((row: HTMLTableRowElement) => {
      row.classList.remove("tr-group-first", "tr-group-last");
    });

    for (let i = 0; i < rows.length; i++) {
      const currentRow: HTMLTableRowElement = rows[i];

      const isHeaderRow: boolean = currentRow.querySelector("th") !== null;

      if (isHeaderRow) {
        const previousRow: HTMLTableRowElement | undefined = rows[i - 1];
        const previousIsHeader: boolean = previousRow
          ? previousRow.querySelector("th") !== null
          : false;

        if (i === 0 || !previousIsHeader) {
          currentRow.classList.add("tr-group-first");
        }

        const nextRow: HTMLTableRowElement | undefined = rows[i + 1];
        const nextIsHeader: boolean = nextRow
          ? nextRow.querySelector("th") !== null
          : false;

        if (!nextRow || !nextIsHeader) {
          currentRow.classList.add("tr-group-last");
        }
      }
    }
  });
};
