import { Node, mergeAttributes, nodeInputRule } from "@tiptap/core";

export const Variable = Node.create({
  name: "variable",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      name: {
        default: "",
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-variable]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-variable": "",
      }),
      `\\${HTMLAttributes.name}`,
    ];
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: /\\([a-zA-Z][a-zA-Z0-9_]*)$/,
        type: this.type,
        getAttributes (match){

            console.log(match);
            return {name: match[1]}
        },
      }),
    ];
  },
});