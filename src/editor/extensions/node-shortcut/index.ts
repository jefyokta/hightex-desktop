import { uniqId } from "@/utils/uniq-id";
import { createTable } from "@tiptap/extension-table";
import { PluginKey } from "@tiptap/pm/state";
import { Extension, Range } from "@tiptap/react";
import Suggestion, { SuggestionOptions } from "@tiptap/suggestion";
import { createRenderer } from "../utilites";
import { createFigureTable } from "@/editor/utils/create-figure-table";
type NSItems = {
  label: string;
  onClick: (range: Range) => any;
};
export const NodeShortcut = Extension.create({
  name: "nodeShortcut",

  addProseMirrorPlugins() {
    return [
      Suggestion({
        char: "!",
        pluginKey: new PluginKey("nodeShortCutSuggetion"),
        editor: this.editor,
        items: ({ query }) => {
          const suggestions: NSItems[] = [];
          const lower = query.toLowerCase();

          const table = matchFigureTable(lower);
          const img = matchFigureImage(lower);

          if (table) {
            suggestions.push({
              label: `Table ${table.cols}x${table.rows} ${table.caption ? `| Table xx. ${table.caption}` : ""}`,
              onClick: (range: Range) => {
                this.editor
                  .chain()
                  .focus()
                  .deleteRange(range)
                  .insertContent(
                    createFigureTable(
                      table.rows,
                      table.cols,
                      table.caption || "Tabel Caption",
                    ),
                  )
                  .run();
              },
            });
          }

          if (img) {
            suggestions.push({
              label: "Figure Image",
              onClick: (range) => {
                this.editor
                  .chain()
                  .focus()
                  .deleteRange(range)
                  .insertContent({
                    type: "imageFigure",
                    attrs: {
                      figureId: uniqId(),
                    },
                    content: [
                      {
                        type: "image",
                        attrs: {
                          src: "",
                        },
                      },
                      {
                        type: "figcaption",
                        text:
                          typeof img !== "boolean" && img.caption
                            ? img.caption
                            : "Image Caption",
                      },
                    ],
                  })
                  .run();
              },
            });
          }

          return suggestions;
        },
        render: () =>
          createRenderer({
            onSelect(item, range) {
              item.onClick(range);
            },
            header: {
              title: "Insert Node",
            },
          }),
      } as SuggestionOptions),
    ];
  },
});

const getNumber = (string: string) => {
  const num = parseInt(string, 10) || 3;
  return num > 0 && num < 8 ? num : 3;
};
const matchFigureTable = (text: string) => {
  const rowMatch = text.match(/^tab\.(\d+)\.(\d+)\.?$/);
  const colsMatch = text.match(/^tab\.(\d+)\.?$/);
  const captionMatch = text.match(/^tab\.(\d+)\.(\d+)\.(\w+)$/);

  if (captionMatch) {
    return {
      cols: getNumber(captionMatch[1]),
      rows: getNumber(captionMatch[2]),
      caption: captionMatch[3].replace(/_/g, " ") || "",
    };
  }

  if (rowMatch) {
    return {
      cols: getNumber(rowMatch[1]),
      rows: getNumber(rowMatch[2]),
      caption: "",
    };
  }
  if (colsMatch) {
    return {
      cols: getNumber(colsMatch[1]),
      rows: 3,
      caption: "",
    };
  }
  if (!text || "tab.".startsWith(text)) {
    return { cols: 3, rows: 3 };
  }

  return false;
};

const matchFigureImage = (text: string) => {
  if (!text || "fig.".startsWith(text)) {
    return true;
  }
  const hasCaption = text.match(/^fig\.(\w+)/);
  if (hasCaption) {
    return {
      caption: hasCaption[1].replace("_", " "),
    };
  }
  return false;
};
