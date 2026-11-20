import { chapterContentNodeView } from "@/editor/chapter/content-node-view";
import { getExtensionField } from "@tiptap/core";
import type { Schema } from "@tiptap/pm/model";
import type { Plugin } from "@tiptap/pm/state";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";

import { CodeBlockComponent } from "./component";
const lowlight = createLowlight(common);
export const CustomCodeBlock = CodeBlockLowlight.extend({
  renderHTML(props) {
    return ["div", { style: "position:relative" }, this.parent!(props)];
  },
  addNodeView() {
    return chapterContentNodeView(CodeBlockComponent);
  },
}).configure({
  lowlight,
  defaultLanguage: "plaintext",
});

/** Reuse the extension's presentation plugin; readonly views omit paste/edit handlers. */
export function chapterCodePresentationPlugins(schema: Schema) {
  if (!schema.nodes.codeBlock) return [];
  const plugins = getExtensionField<() => Plugin[]>(
    CustomCodeBlock,
    "addProseMirrorPlugins",
    {
      name: CustomCodeBlock.name,
      options: CustomCodeBlock.options,
      storage: CustomCodeBlock.storage,
      type: schema.nodes.codeBlock,
    },
  )();
  return plugins.filter((plugin) => !!plugin.props.decorations);
}
