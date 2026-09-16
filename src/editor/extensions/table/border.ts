import { createTableBorderPlugin } from "@/editor/plugins/table-border";
import { Extension } from "@tiptap/core";

export const TableBorder = Extension.create({
    name:"table-header-border",
    addProseMirrorPlugins(){

        return [createTableBorderPlugin()];
    }
})