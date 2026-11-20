import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { mergePaginationOptions, type PaginationOptions } from "./options";
import { PaginationInput } from "./input";
import { PaginationView } from "./view";
import { DocumentNumberingView } from "./document-numbering-view";
import {
  paginationKey,
  createPaginationState,
  applyPaginationTransaction,
  type PaginationState,
  type PaginationUpdate,
} from "./state";
export { paginationKey } from "./state";
export type { PaginationOptions } from "./options";
export type { PageNumberOptions, PageNumberPosition } from "./presentation/page-number";
export type {
  SectionOptions,
  SectionGroup,
  PageNumberFormat,
} from "@/types/pagination/section-options";

export const EditorPagination = Extension.create<PaginationOptions>({
  name: "editorPagination",
  addOptions() {
    return {
      margins: {
        top: 30,
        right: 30,
        bottom: 30,
        left: 30,
      },
      repeatTableCaption: true,
      repeatTableHeader: true,
      documentNumbering: true,
    };
  },
  addCommands() {
    return {
      configureEditorPagination:
        (patch: PaginationOptions) =>
        ({ tr, state }) => {
          const previous =
            (tr.getMeta(paginationKey) as PaginationUpdate | undefined)
              ?.options ?? paginationKey.getState(state)!.options;
          const options = mergePaginationOptions(previous, patch);
          tr.setMeta(paginationKey, {
            ...(tr.getMeta(paginationKey) ?? {}),
            options,
          } satisfies PaginationUpdate);
          tr.setMeta("addToHistory", false);
          return true;
        },
      setEditorPagination:
        (enabled: boolean) =>
        ({ tr }) => {
          tr.setMeta(paginationKey, {
            ...(tr.getMeta(paginationKey) ?? {}),
            enabled,
          } satisfies PaginationUpdate);
          tr.setMeta("addToHistory", false);
          return true;
        },
    };
  },
  addProseMirrorPlugins() {
    const options = mergePaginationOptions({}, this.options);
    return [
      new Plugin<PaginationState>({
        key: paginationKey,
        state: {
          init: () => createPaginationState(options),
          apply: applyPaginationTransaction,
        },
        props: {
          ...new PaginationInput(paginationKey).props,
          decorations: (state) => paginationKey.getState(state)?.decorations,
          attributes: (state) => ({
            "data-editor-pagination": String(
              paginationKey.getState(state)?.enabled ?? false,
            ),
          }),
        },
        view: (view) => {
          const pagination = new PaginationView(view, this.editor);
          const numbering = new DocumentNumberingView(
            this.editor,
            pagination.sources,
          );
          return {
            update(view, previous) {
              pagination.update(view, previous);
              numbering.update(view, previous);
            },
            destroy() {
              numbering.destroy();
              pagination.destroy();
            },
          };
        },
      }),
    ];
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    editorPagination: {
      configureEditorPagination(options: PaginationOptions): ReturnType;
      setEditorPagination(enabled: boolean): ReturnType;
    };
  }
}
