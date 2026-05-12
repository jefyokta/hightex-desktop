import { Editor } from "@tiptap/core";
import { ensureUniqueId } from "../extensions/utilites";
import { EditorState } from "@tiptap/pm/state";
import { Chapter } from "../chapter/chapter";

export const events = {
  create: ({ editor }: { editor: Editor }) => {
    queueMicrotask(async () => {
      const ch = await Chapter.instance!.getContent();

      const content = ch ?? {
        type: "doc",
        content: [{ type: "paragraph" }],
      };

      if (editor.isDestroyed) return;

      editor.commands.setContent(content, {
        emitUpdate: false,
      });

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
