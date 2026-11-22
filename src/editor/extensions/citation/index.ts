import { Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { Citation } from "./citation";

import { CitePaste } from "@/editor/plugins/cite-paste";
import { citationSuggestion } from "./suggestion";

type CiteOptions = {
  cite: string;
  citeA?: boolean;
};

export const Cite = Node.create<CiteOptions>({
  name: "cite",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      cite: {
        default: "",
        parseHTML: (element) => element.getAttribute("cite") || "",
        renderHTML: (attributes) => ({ cite: attributes.cite }),
      },
      citeA: {
        default: false,
        parseHTML: (element) => element.hasAttribute("citeA"),
        renderHTML: (attributes) => (attributes.citeA ? { citeA: "true" } : {}),
      },
      manual: {
        default: false,
      },
      text: {
        default: "",
      },
      year: {
        default: "",
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "cite[cite]",
        attrs: {
          cite: this.options.cite,
          citeA: this.options.citeA,
        },
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["cite", HTMLAttributes];
  },
  addNodeView() {
    return ReactNodeViewRenderer(Citation);
  },

  addCommands(): any {
    return {
      insertCitation:
        (opt: CiteOptions) =>
        ({ commands }: any) => {
          return commands.insertContent({
            type: this.name,
            attrs: { cite: opt.cite, citeA: opt.citeA || false },
          });
        },
    };
  },

  addProseMirrorPlugins() {
    return [citationSuggestion(this.editor, "@"), citationSuggestion(this.editor, "#"), CitePaste];
  },
});
