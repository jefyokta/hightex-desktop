import { Extension, JSONContent } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { uniqId } from "../../../utils/uniq-id";

export const ForceHeading = Extension.create<{
  marks: JSONContent[];
  title: string;
}>({
  addOptions() {
    return {
      marks: [],
      title: "",
    };
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction: (_, __, newState) => {
          const { doc, schema } = newState;
          const firstNode = doc.firstChild;

          const markNodes = this.options.marks
            ? this.options.marks
                .map((m) => {
                  if (!m.type) return null;
                  const markType = schema.marks[m.type];
                  return markType ? markType.create(m.attrs || {}) : null;
                })
                .filter(Boolean)
            : [];

          const createHeading = (text: string) =>
            schema.nodes.heading.create(
              { level: 1, id: uniqId() },
              schema.text(text, markNodes as any),
            );

          if (!firstNode) {
            return newState.tr.insert(0, createHeading(this.options.title));
          }

          if (
            firstNode.type.name !== "heading" ||
            firstNode.attrs.level !== 1
          ) {
            return newState.tr.insert(
              0,
              firstNode.type.name === "text"
                ? schema.nodes.heading.create(
                    { level: 1, id: uniqId() },
                    firstNode,
                  )
                : createHeading(this.options.title),
            );
          }

          return null;
        },
      }),
    ];
  },
});
