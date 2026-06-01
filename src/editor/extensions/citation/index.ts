import { Node, Range } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import { ReactNodeViewRenderer } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import { bibToObject, CiteUtils } from "bibtex.js";
import { Citation } from "./citation";

import { HighTexDB } from "../../storage/hightex-db";
import { CitePaste } from "@/editor/plugins/cite-paste";
import { createRenderer, RendererItem } from "../utilites";

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
    return ["span", HTMLAttributes, 0];
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
    return [
      Suggestion<RendererItem>({
        char: "@",
        pluginKey: new PluginKey("citation-suggestion"),

        items: async ({ query }) => {
          const cite = await HighTexDB.getInstance().cite.toArray();
          if (!cite) {
            return [];
          }
          return cite
            .map(({ key, bib }) => {
              const obj = bibToObject(bib)[0];
              return new CiteUtils(obj).setId(key);
            })
            .filter((c) => {
              const title = c.getTitle() as string;
              return title.toLowerCase().includes(query.toLowerCase());
            })
            .map(
              (c) =>
                ({
                  label: c.getTitle(),
                  onClick: (range: Range) => {
                    this.editor
                      .chain()
                      .focus()
                      .deleteRange(range)
                      .insertContent({
                        type: "cite",
                        attrs: {
                          citeA: false,
                          cite: c.getId(),
                        },
                      })
                      .run();
                  },
                  subLabel: c.toCite(),
                  keywords: ["test", "test2"],
                }) satisfies RendererItem,
            );
        },

        command({ editor, range, props }) {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent({
              type: "cite",
              attrs: {
                citeA: false,
                cite: props.getId(),
              },
            })
            .run();
        },

        render: () =>
          createRenderer({
            onSelect: (item, range) => item.onClick(range),
            header: {
              title: "Cite",
              subtitle: "Choose to insert a cite",
            },
          }),
        editor: this.editor,
      }),

      Suggestion<RendererItem>({
        char: "#",
        pluginKey: new PluginKey("citation-a-suggestion"),

        items: async ({ query }) => {
          const cite = await HighTexDB.getInstance().cite.toArray();
          if (!cite) {
            return [];
          }
          return cite
            .map(({ key, bib }) => {
              const obj = bibToObject(bib)[0];
              return new CiteUtils(obj).setId(key);
            })
            .filter((c) => {
              const title = c.getTitle() as string;
              return title.toLowerCase().includes(query.toLowerCase());
            })
            .map(
              (c) =>
                ({
                  label: c.getTitle(),
                  onClick: (range: Range) => {
                    this.editor
                      .chain()
                      .focus()
                      .deleteRange(range)
                      .insertContent({
                        type: "cite",
                        attrs: {
                          citeA: true,
                          cite: c.getId(),
                        },
                      })
                      .run();
                  },
                  subLabel: c.toCiteA(),
                  keywords: ["test", "test2"],
                }) satisfies RendererItem,
            );
        },

        command({ editor, range, props }) {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent({
              type: "cite",
              attrs: {
                citeA: true,
                cite: props.getId(),
              },
            })
            .run();
        },

        render: () =>
          createRenderer({
            onSelect: (item, range) => item.onClick(range),
            header: {
              title: "Cite A",
              subtitle: "Choose to insert a cite",
            },
          }),
        editor: this.editor,
      }),
      CitePaste,
    ];
  },
});
