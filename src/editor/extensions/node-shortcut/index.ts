import { PluginKey } from "@tiptap/pm/state";
import { Extension, Range } from "@tiptap/react";
import Suggestion, { SuggestionOptions } from "@tiptap/suggestion";
import { createRenderer } from "../utilites";
import { createFigureTable } from "@/editor/utils/create-figure-table";
import { createFigureImage } from "@/editor/utils/create-figure-image";
import { matchFigureImage, matchFigureTable } from "./parse";
type NSItems = {
  label: string;
  onClick: (range: Range) => void;
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
          const table = matchFigureTable(query);
          const img = matchFigureImage(query);

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
                  .insertContent(
                    createFigureImage(
                      null,
                      typeof img !== "boolean" ? img.caption : undefined,
                    ),
                  )
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
