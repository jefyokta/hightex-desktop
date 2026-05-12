import { Paragraph as TipTapParagraph } from "@tiptap/extension-paragraph";
import { UUIDAttributes } from "../uuid";

export const Paragraph = TipTapParagraph.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...UUIDAttributes(this.name),
    };
  },
});
