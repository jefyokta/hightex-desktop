import { InputRule, mergeAttributes, Node } from "@tiptap/core";

export const Dots = Node.create({
  name: "dots",

  group: "inline",
  inline: true,

  atom: true,
  selectable: false,

  addAttributes() {
    return {};
  },

  parseHTML() {
    return [
      {
        tag: "span[data-dots]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(
        {
          "data-dots": "",
          contenteditable: "false",
        },
        HTMLAttributes,
      ),
      "...",
    ];
  },

  renderText() {
    return "...";
  },

  addInputRules() {
    return [
      new InputRule({
        find: /\.\.\.$/,
        handler: ({ range, commands }) => {
          commands.deleteRange(range);

          commands.insertContentAt(range.from, {
            type: this.name,
          });
        },
      }),
    ];
  },

  addCommands() {
    return {
      insertDots:
        () =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
          }),
    };
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    dots: {
      insertDots: () => ReturnType;
    };
  }
}
