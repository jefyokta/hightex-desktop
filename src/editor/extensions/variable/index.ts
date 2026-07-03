import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { VariableComponent } from "./component";
import { VariableSuggestion } from "@/editor/plugins/var-suggestion";

export type VariableCase =
  | "preserve"
  | "lower"
  | "upper"
  | "capitalize"
  | "title";

export const Variable = Node.create({
  name: "variable",

  inline: true,
  atom: true,
  group: "inline",

  addAttributes() {
    return {
      name: {
        default: "",
      },
      case: {
        default: "preserve",
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-variable]",
        getAttrs: (element) => {
          const el = element as HTMLElement;
          return {
            name: el.dataset.name,
            case: el.dataset.case ?? "preserve",
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-variable": "",
        "data-name": HTMLAttributes.name,
        "data-case": HTMLAttributes.case,
      }),
      `\\${HTMLAttributes.name}${
        HTMLAttributes.case !== "preserve" ? "." + HTMLAttributes.case : ""
      }`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VariableComponent);
  },
  addProseMirrorPlugins() {
    return [VariableSuggestion(this.editor)];
  },

  addCommands() {
    return {
      insertVariable:
        (text: string) =>
        ({ commands }) => {
          const [name, caseMode = "preserve"] = text.split(".");

          return commands.insertContent({
            type: this.name,
            attrs: {
              name,
              case: caseMode,
            },
          });
        },
    };
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    variable: {
      insertVariable(text: string): ReturnType;
    };
  }
}
