import { ipcMain } from "electron";
import { JSONContent } from "@tiptap/core";
import { PluginManager } from "../plugins/plugin-manager";

export class PluginScannerHandler {
  static register() {
    ipcMain.handle(
      "plugin:scanner.text",
      async (_, pluginKey: string, text: string, context: ScannerContext) => {
        const plugin = PluginManager.plugins.get(pluginKey);
        const errs: TextError[] = [];
        const addError = (err: TextError) => {
          errs.push(err);
        };

        if (!plugin?.scanner?.onParagraph) {
          return [];
        }

        await plugin?.scanner?.onParagraph?.(text, {
          addError,
          scanner: context,
          text,
        });

        return errs;
      },
    );

    ipcMain.handle(
      "plugin:scanner.node",
      async (
        _event,
        pluginKey: string,
        node: JSONContent,
        context: ScannerContext,
      ) => {
        const plugin = PluginManager.plugins.get(pluginKey);
        const errs: NodeError[] = [];
        const addError = (err: NodeError) => {
          errs.push(err);
        };

        if (!plugin?.scanner?.onNode) {
          return [];
        }

        const ctx: NodePluginContext = {
          scanner: context,
          addError,
        };

        await plugin.scanner.onNode(node, ctx);

        return errs;
      },
    );
  }
}
