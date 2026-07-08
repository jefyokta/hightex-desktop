import { Editor, JSONContent } from "@tiptap/core";
import { ensureUniqueId } from "../extensions/utilites";
import { EditorState } from "@tiptap/pm/state";
import { Chapter } from "../chapter/chapter";
import { ContentFixer } from "@/utils/content-fixer";
export const events = {
  create: ({ editor }: { editor: Editor }) => {
    queueMicrotask(async () => {
      const ch = await Chapter.instance!.getContent();
      const isEmpty = () => {
        if (!ch) {
          return Boolean(ch);
        }
        if (Array.isArray(ch)) {
          return ch.length == 0;
        }

        return false;
      };
      const emptyDoc: JSONContent = {
        type: "doc",
        content: [{ type: "paragraph" }],
      };

      let content = isEmpty() ? emptyDoc : ch;
      content = ContentFixer(content, editor.state.schema);

      if (editor.isDestroyed) return;
      editor.commands.setContent(content, {
        emitUpdate: false,
      });
      if ("fixTables" in editor.commands) {
        editor.commands.fixTables();
      }

      const newState = EditorState.create({
        doc: editor.state.doc,
        plugins: editor.state.plugins,
        schema: editor.state.schema,
      });
      editor.view.updateState(newState);

      editor.commands.focus();

      ensureUniqueId(editor);
    });
  },
  update: async ({ editor }: { editor: Editor }) => {
    await Chapter.instance?.setContent(editor.getJSON().content);
  },
} as const;

export type Events = typeof events;
