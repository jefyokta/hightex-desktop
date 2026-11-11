import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { EDITOR_PAGE, paginateUnits, type PageLayout } from "./layout";
import { measureEditor } from "./measure";

interface PaginationState {
  enabled: boolean;
  decorations: DecorationSet;
  layout: PageLayout;
}
type PaginationUpdate = { enabled?: boolean; layout?: PageLayout };
export const paginationKey = new PluginKey<PaginationState>("editorPagination");
const emptyLayout = (): PageLayout => ({
  breaks: [],
  pages: 1,
  unsupported: false,
});

function decorations(
  viewDoc: Parameters<typeof DecorationSet.create>[0],
  layout: PageLayout,
) {
  return DecorationSet.create(
    viewDoc,
    layout.breaks.map((item) =>
      item.kind === "block"
        ? Decoration.node(item.from, item.to!, {
            class: "editor-pagination-block",
            style: `--editor-break-height:${item.height}px;--editor-original-margin:${item.marginTop ?? 0}px`,
          })
        : Decoration.widget(
            item.from,
            () => {
              const spacer = document.createElement("span");
              spacer.setAttribute("data-editor-page-break", "");
              spacer.setAttribute("aria-hidden", "true");
              spacer.contentEditable = "false";
              spacer.style.height = `${item.height}px`;
              return spacer;
            },
            {
              side: -1,
              key: `${item.from}:${item.height}`,
              ignoreSelection: true,
            },
          ),
    ),
  );
}

class PaginationView {
  private timer?: ReturnType<typeof setTimeout>;
  private frame?: number;
  private destroyed = false;
  private resize: ResizeObserver;
  private mutations: MutationObserver;
  private sheets = document.createElement("div");
  private page: HTMLElement | null;
  private signature = "";

  constructor(private view: EditorView) {
    this.page = view.dom.closest<HTMLElement>(".page");
    this.sheets.className = "editor-pagination-sheets";
    this.sheets.setAttribute("aria-hidden", "true");
    this.resize = new ResizeObserver(() => this.schedule());
    this.resize.observe(view.dom);
    this.mutations = new MutationObserver((records) => {
      if (
        records.some(
          (record) =>
            !(
              record.target instanceof Element &&
              record.target.closest("[data-editor-page-break]")
            ),
        )
      )
        this.schedule();
    });
    this.mutations.observe(view.dom, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    });
    document.fonts.addEventListener("loadingdone", this.schedule);
    view.dom.addEventListener("load", this.schedule, true);
    view.dom.addEventListener("compositionend", this.schedule);
    void document.fonts.ready.then(() => {
      if (!this.destroyed) this.schedule();
    });
    this.update(view);
  }

  update(view: EditorView, previous?: EditorState) {
    this.view = view;
    const state = paginationKey.getState(view.state)!;
    const active = state.enabled && !state.layout.unsupported;
    this.page ??= view.dom.closest<HTMLElement>(".page");
    this.page?.toggleAttribute("data-paginated-editor", active);
    if (active && this.page) {
      this.page.style.setProperty(
        "--editor-page-height",
        `${EDITOR_PAGE.height}px`,
      );
      this.page.style.setProperty("--editor-page-gap", `${EDITOR_PAGE.gap}px`);
      this.page.style.setProperty(
        "--editor-page-count",
        String(state.layout.pages),
      );
      if (!this.sheets.isConnected) this.page.append(this.sheets);
      while (this.sheets.childElementCount > state.layout.pages)
        this.sheets.lastElementChild!.remove();
      while (this.sheets.childElementCount < state.layout.pages) {
        const sheet = document.createElement("div");
        sheet.className = "editor-pagination-sheet";
        const number = document.createElement("span");
        number.className = "editor-pagination-number";
        number.textContent = String(this.sheets.childElementCount + 1);
        sheet.style.top = `${this.sheets.childElementCount * (EDITOR_PAGE.height + EDITOR_PAGE.gap)}px`;
        sheet.append(number);
        this.sheets.append(sheet);
      }
    } else {
      this.sheets.remove();
      this.clearPageStyle();
    }
    if (!state.enabled) this.signature = "";
    if (
      !previous ||
      previous.doc !== view.state.doc ||
      paginationKey.getState(previous)?.enabled !== state.enabled
    )
      this.schedule();
  }

  private clearPageStyle() {
    for (const key of ["height", "gap", "count"])
      this.page?.style.removeProperty(`--editor-page-${key}`);
  }

  private schedule = () => {
    if (this.destroyed || !paginationKey.getState(this.view.state)?.enabled)
      return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      cancelAnimationFrame(this.frame ?? 0);
      this.frame = requestAnimationFrame(() => this.measure());
    }, 120);
  };

  private measure() {
    if (this.destroyed || !paginationKey.getState(this.view.state)?.enabled)
      return;
    if (this.view.composing) return;
    const units = measureEditor(this.view);
    if (!units) return;
    const layout = paginateUnits(units);
    const signature = JSON.stringify(layout);
    if (signature === this.signature) return;
    this.signature = signature;
    this.view.dispatch(
      this.view.state.tr
        .setMeta(paginationKey, { layout } satisfies PaginationUpdate)
        .setMeta("addToHistory", false),
    );
  }

  destroy() {
    this.destroyed = true;
    clearTimeout(this.timer);
    cancelAnimationFrame(this.frame ?? 0);
    this.resize.disconnect();
    this.mutations.disconnect();
    document.fonts.removeEventListener("loadingdone", this.schedule);
    this.view.dom.removeEventListener("load", this.schedule, true);
    this.view.dom.removeEventListener("compositionend", this.schedule);
    this.sheets.remove();
    this.page?.removeAttribute("data-paginated-editor");
    this.clearPageStyle();
  }
}

export const EditorPagination = Extension.create({
  name: "editorPagination",
  addCommands() {
    return {
      setEditorPagination:
        (enabled: boolean) =>
        ({ tr }) => {
          tr.setMeta(paginationKey, { enabled } satisfies PaginationUpdate);
          tr.setMeta("addToHistory", false);
          return true;
        },
    };
  },
  addProseMirrorPlugins() {
    return [
      new Plugin<PaginationState>({
        key: paginationKey,
        state: {
          init: () => ({
            enabled: false,
            decorations: DecorationSet.empty,
            layout: emptyLayout(),
          }),
          apply(tr, previous) {
            const update = tr.getMeta(paginationKey) as
              | PaginationUpdate
              | undefined;
            const enabled = update?.enabled ?? previous.enabled;
            const layout = enabled
              ? (update?.layout ?? previous.layout)
              : emptyLayout();
            return {
              enabled,
              layout,
              decorations: !enabled
                ? DecorationSet.empty
                : update?.layout
                  ? decorations(tr.doc, layout)
                  : previous.decorations.map(tr.mapping, tr.doc),
            };
          },
        },
        props: {
          decorations: (state) => paginationKey.getState(state)?.decorations,
          attributes: (state) => ({
            "data-editor-pagination": String(
              paginationKey.getState(state)?.enabled ?? false,
            ),
          }),
        },
        view: (view) => new PaginationView(view),
      }),
    ];
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    editorPagination: {
      setEditorPagination(enabled: boolean): ReturnType;
    };
  }
}
