import Suggestion from "@tiptap/suggestion";
import { createRenderer } from "../extensions/utilites";
import { Editor } from "@tiptap/core";
import { Range } from "@tiptap/react";
import { Document } from "../document";
import { renderNodeToText } from "@/components/editor/text-renderer";

type SlashItem = {
  label: string;
  onClick: (range: Range, query: string) => void;
};

type SlashCommand = {
  name: string;
  match: (query: string) => boolean;
  search: (query: string, editor: Editor) => SlashItem[] | Promise<SlashItem[]>;
};

const commands: SlashCommand[] = [
  {
    name: "img",
    match: (q) => q.startsWith("img"),
    search: async (query, editor) => {
      let keyword = query.slice(3).trim().toLowerCase();
      if (keyword[0] == ".") {
        keyword = keyword.slice(1);
      }

      const allImages = (await Document.instance?.getImages()) || [];

      const resolved = await Promise.all(
        allImages
          .filter((image) => {
            const numbering = (image.numbering || "").toLowerCase();

            const textMatch = (image.text || [])
              .map((_n) => "")
              .join(" ")
              .toLowerCase();

            return numbering.includes(keyword) || textMatch.includes(keyword);
          })
          .map(async (image) => {
            const text = await renderNodeToText(image.text || []);

            return {
              label: image.numbering + " " + text,
              onClick(range: Range) {
                editor
                  .chain()
                  .focus()
                  .deleteRange(range)
                  .insertContent({
                    type: "refComponent",
                    attrs: {
                      link: image.id,
                      ref: "imageFigure",
                    },
                  })
                  .run();
              },
            };
          }),
      );

      return resolved;
    },
  },

  {
    name: "table",
    match: (q) => q.startsWith("table"),
    search: async (query, editor) => {
      let keyword = query.slice(5).trim().toLowerCase();
      if (keyword[0] == ".") {
        keyword = keyword.slice(1);
      }

      const alltables = (await Document.instance?.getTables()) || [];

      const resolved = await Promise.all(
        alltables
          .filter((table) => {
            const numbering = (table.numbering || "").toLowerCase();

            const textMatch = (table.text || [])
              .map((_n) => "")
              .join(" ")
              .toLowerCase();

            return numbering.includes(keyword) || textMatch.includes(keyword);
          })
          .map(async (table) => {
            const text = await renderNodeToText(table.text || []);

            return {
              label: table.numbering + " " + text,
              onClick(range: Range) {
                editor
                  .chain()
                  .focus()
                  .deleteRange(range)
                  .insertContent({
                    type: "refComponent",
                    attrs: {
                      link: table.id,
                      ref: "figureTable",
                    },
                  })
                  .run();
              },
            };
          }),
      );

      return resolved;
    },
  },
];

const resolveSearch = async (query: string, editor: Editor) => {
  const cmd = commands.find((c) => c.match(query));
  if (!cmd) return [];
  return await cmd.search(query, editor);
};

export const SlashSuggestion = (editor: Editor) =>
  Suggestion({
    char: "/",
    editor,

    shouldShow({ query }) {
      return commands.some((c) => c.match(query));
    },

    items: async ({ query, editor }) => {
      return await resolveSearch(query, editor);
    },

    render() {
      return createRenderer({
        onSelect(item, range) {
          item.onClick(range);
        },
        header: {
          title: "Figures in your documents",
          subtitle: "Choose to reference them",
        },
      });
    },
  });
