import type { Editor } from "@tiptap/core";
import { ensureUniqueId } from "../extensions/utilites";
import { EditorState } from "@tiptap/pm/state";
import type { Chapter } from "../chapter/chapter";
import { Storage } from "../storage";
import { ContentFixer } from "@/utils/content-fixer";
import { convertTableHeaderLikeCells } from "@/utils/convert-table-header-like";
import { migrateGridToTable } from "@/utils/migrate-grid-to-table";

const editorSessions = new WeakMap<
  Editor,
  { chapter: Chapter; ready: boolean }
>();
const normalizing = new WeakSet<Editor>();

export function getEditorChapter(editor: Editor): Chapter | undefined {
  const session = editorSessions.get(editor);
  return !editor.isDestroyed && session?.ready ? session.chapter : undefined;
}

export const events = {
  create: async ({
    editor,
    chapter,
    isCurrent = () => true,
  }: {
    editor: Editor;
    chapter: Chapter;
    isCurrent?: () => boolean;
  }): Promise<boolean> => {
    editorSessions.delete(editor);
    if (editor.isDestroyed || !isCurrent()) return false;
    const session = { chapter, ready: false };
    editorSessions.set(editor, session);
    const active = () =>
      !editor.isDestroyed &&
      isCurrent() &&
      editorSessions.get(editor) === session;
    editor.setEditable(false, false);

    await Storage.instance.waitForChapter(chapter.getId());
    if (!active()) return false;
    const content = await chapter.getContent();
    if (!active()) return false;
    const migrated = await migrateGridToTable(content);
    if (!active()) return false;

    const fixed = ContentFixer(migrated, editor.state.schema);
    editor.commands.setContent(fixed, { emitUpdate: false });
    if ("fixTables" in editor.commands) editor.commands.fixTables();
    ensureUniqueId(editor);
    convertTableHeaderLikeCells(editor);
    if (!active()) return false;

    // Initial normalization must not become an undo step or an autosave.
    editor.view.updateState(
      EditorState.create({
        doc: editor.state.doc,
        plugins: editor.state.plugins,
        schema: editor.state.schema,
      }),
    );
    if (!active()) return false;
    session.ready = true;
    editor.setEditable(true, false);
    return true;
  },
  update: async ({ editor }: { editor: Editor }): Promise<void> => {
    const chapter = getEditorChapter(editor);
    if (!chapter || !editor.isEditable || normalizing.has(editor)) return;

    normalizing.add(editor);
    try {
      convertTableHeaderLikeCells(editor);
    } finally {
      normalizing.delete(editor);
    }
    await chapter.setContent(editor.getJSON().content ?? []);
  },
  destroy: ({ editor }: { editor: Editor }): void => {
    editorSessions.delete(editor);
    normalizing.delete(editor);
    if (!editor.isDestroyed) editor.setEditable(false, false);
  },
} as const;

export type Events = typeof events;
