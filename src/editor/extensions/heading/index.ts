import TipTapHeading from "@tiptap/extension-heading";
import { UUIDAttributes } from "../uuid";

export const Heading = TipTapHeading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...UUIDAttributes(this.name),
    };
  },
});
