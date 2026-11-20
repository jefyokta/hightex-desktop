import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { getEditorChapter } from "@/editor/event";
import { needsNodeIdentity } from "./identity";
import { pastedIdentities } from "./pasted-identities";
import { UUIDAttributes } from ".";

export const NodeIdentity = Extension.create({
  name: "nodeIdentity",
  addGlobalAttributes() {
    return [
      {
        types: this.extensions
          .filter(
            (extension) =>
              extension.type === "node" &&
              extension.name !== "doc" &&
              extension.name !== "text",
          )
          .map((extension) => extension.name),
        attributes: UUIDAttributes(),
      },
    ];
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          transformPasted: (slice, view) => {
            const occupied = new Set<string>();
            view.state.doc.descendants((node) => {
              if (needsNodeIdentity(node.attrs) && node.attrs.id)
                occupied.add(node.attrs.id);
            });
            const chapter = getEditorChapter(this.editor);
            const otherChapters = chapter?.document.identities.reserved(
              chapter.getId(),
            );
            return pastedIdentities(slice, {
              has: (id) => occupied.has(id) || Boolean(otherChapters?.has(id)),
            });
          },
        },
      }),
    ];
  },
});
