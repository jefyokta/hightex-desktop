import { ReactNodeViewRenderer } from "@tiptap/react";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";

import { CodeBlockComponent } from "./component";
const lowlight = createLowlight(common);
export const CustomCodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockComponent);
  },
}).configure({
  lowlight,
  defaultLanguage: "plaintext",
});
