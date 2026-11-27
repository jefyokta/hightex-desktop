import { Node } from "@tiptap/react";
import { uniqId } from "../../../utils/uniq-id";

export const UUID = Node.create({
  name: "uuid",
  addAttributes() {
    if (typeof this == "undefined") {
      return UUIDAttributes("node");
    }
    return UUIDAttributes(this.name);
  },
});

export function UUIDAttributes(prefix?: string) {
  return {
    id: {
      // Schema defaults are shared by every node of this type. The editor's
      // ID normalizer assigns each new node its own stored identity.
      default: null,

      parseHTML(element: HTMLElement) {
        return (
          element.getAttribute("id") ||
          `${prefix ? prefix + "-" : ""}${uniqId()}`
        );
      },

      renderHTML(attributes: any) {
        return {
          // Only the source identity owner allocates IDs. Rendering a missing ID
          // must not create an anchor that has no corresponding source node.
          id: attributes.id || null,
        };
      },

      keepOnSplit: false,
    },

    shouldUnique: {
      default: true,
    },
  };
}
