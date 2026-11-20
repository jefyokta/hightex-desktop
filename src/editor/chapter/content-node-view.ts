import {
  NodeView,
  type NodeViewProps,
  type NodeViewRenderer,
} from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import type { ComponentType } from "react";
import type { Node as ModelNode } from "@tiptap/pm/model";
import type { Decoration, DecorationSource } from "@tiptap/pm/view";
import { chapterContentDOM, updateChapterContentDOM } from "./content-dom";

export type ChapterControlProps = Pick<
  NodeViewProps,
  "editor" | "node" | "getPos" | "updateAttributes" | "deleteNode"
> & { content: HTMLElement };

/** Native content owns editing bindings; React owns only the disposable controls. */
export function chapterContentNodeView(
  Controls: ComponentType<ChapterControlProps>,
): NodeViewRenderer {
  return (props) =>
    new (class extends NodeView<ComponentType<ChapterControlProps>> {
      private readonly content = chapterContentDOM(
        props.node,
        props.view.dom.ownerDocument,
      );
      // Resource effects belong to the node view's lifetime. A new callback on
      // every decoration update would reload an unchanged image while publishing
      // its layout (temporarily replacing it with the missing-image placeholder).
      private readonly updateContentAttributes: ChapterControlProps["updateAttributes"] =
        (attrs) => this.updateAttributes(attrs);
      private readonly deleteContent = () => this.deleteNode();
      private readonly controls = new ReactRenderer(Controls, {
        editor: props.editor,
        props: this.controlProps(),
      });

      constructor() {
        super(Controls, props);
        this.controls.element.dataset.editorUi = "";
        this.controls.element.dataset.editorNodeControls = "";
        this.controls.element.contentEditable = "false";
        this.controls.element.style.cssText =
          "position:absolute;inset:0;pointer-events:none";
        this.dom.append(this.controls.element);
      }

      get dom() {
        return this.content.dom as HTMLElement;
      }
      get contentDOM() {
        return (this.content.contentDOM as HTMLElement | undefined) ?? null;
      }

      private controlProps(): ChapterControlProps {
        return {
          editor: this.editor,
          node: this.node,
          getPos: this.getPos,
          content: this.dom,
          updateAttributes: this.updateContentAttributes,
          deleteNode: this.deleteContent,
        };
      }

      update(
        node: ModelNode,
        decorations: readonly Decoration[],
        innerDecorations: DecorationSource,
      ) {
        if (node.type !== this.node.type) return false;
        if (!node.sameMarkup(this.node))
          updateChapterContentDOM(
            this.content,
            this.node,
            node,
            this.dom.ownerDocument,
          );
        this.node = node;
        this.decorations = [...decorations];
        this.innerDecorations = innerDecorations;
        this.controls.updateProps(this.controlProps());
        return true;
      }

      destroy() {
        this.controls.destroy();
      }
    })();
}
