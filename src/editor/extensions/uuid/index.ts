import { Node } from "@tiptap/react";
import { uniqId } from "../../../utils/uniq-id";

export const UUID = Node.create({
  name: "uuid",
  addAttributes: () => {
    if (typeof this == "undefined") {
      return UUIDAttributes("node");
    }
    //@ts-ignore
    return UUIDAttributes(this!.name);
  },
});

export function UUIDAttributes(prefix?: string) {
  return {
    id: {
      default: `${prefix ? prefix + "-" : ""}${uniqId()}`,

      parseHTML(element: HTMLElement) {
        return (
          element.getAttribute("id") ||
          `${prefix ? prefix + "-" : ""}${uniqId()}`
        );
      },

      renderHTML(attributes: any) {
        return {
          id: attributes.id || `${prefix ? prefix + "-" : ""}${uniqId()}`,
        };
      },

      keepOnSplit: false,
    },

    shouldUnique: {
      default: true,
    },
  };
}
