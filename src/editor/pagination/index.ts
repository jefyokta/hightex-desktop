import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { EDITOR_PAGE, type PageLayout } from "./layout";
import { measureEditor } from "./measure";
import { FlowCache } from "./flow";
import { paginationInputProps } from "./input";

interface PaginationState {
  enabled: boolean;
  pending: boolean;
  decorations: DecorationSet;
  layout: PageLayout;
}
type PaginationUpdate = { enabled?: boolean; layout?: PageLayout };
export const paginationKey = new PluginKey<PaginationState>("editorPagination");
const emptyLayout = (): PageLayout => ({
  breaks: [],
  pages: 1,
});

function decorations(
  viewDoc: Parameters<typeof DecorationSet.create>[0],
  layout: PageLayout,
) {
  return DecorationSet.create(viewDoc, [
    ...layout.breaks.map((item) =>
      item.kind === "block"
        ? Decoration.node(item.from, item.to!, {
            class: "editor-pagination-block",
            style: `--editor-break-height:${item.height}px;--editor-original-margin:${item.marginTop ?? 0}px`,
          }, { paginationBreak: true })
        : Decoration.widget(
            item.from,
            () => {
              const spacer = document.createElement("span");
              spacer.setAttribute("data-editor-page-break", "");
              spacer.setAttribute("aria-hidden", "true");
              spacer.contentEditable = "false";
              spacer.textContent = "\u2060";
              spacer.style.height = `${item.height}px`;
              return spacer;
            },
            {
              side: -1,
              key: `${item.from}:${item.height}`,
              ignoreSelection: true,
              paginationBreak: true,
            },
          ),
    ),
    ...(layout.rows ?? []).map((row) =>
      Decoration.node(row.from, row.to, {
        class: "editor-pagination-row",
        style: `--editor-row-height:${row.height}px`,
      }),
    ),
    ...(layout.scales ?? []).map((item) =>
      Decoration.node(item.from, item.to, {
        class: "editor-pagination-scaled",
        style: `--editor-atom-scale:${item.scale}`,
      }),
    ),
  ]);
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
  private chromeSignature = "";
  private cache = new FlowCache();
  private task?: AbortController;
  private width = 0;

  constructor(private view: EditorView) {
    this.page = view.dom.closest<HTMLElement>(".page");
    this.sheets.className = "editor-pagination-sheets";
    this.sheets.inert = true;
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
      ) {
        for (const record of records) {
          if (record.target === view.dom) continue;
          try {
            const pos = this.view.posAtDOM(record.target, 0);
            const $pos = this.view.state.doc.resolve(pos);
            let owner = $pos.depth ? $pos.node(1) : undefined;
            for (let depth = $pos.depth; depth > 0; depth--)
              if ($pos.node(depth).isTextblock) {
                owner = $pos.node(depth);
                break;
              }
            if (owner) this.cache.invalidate(owner);
          } catch {
            /* A replaced node no longer belongs to this view. */
          }
        }
        this.schedule();
      }
    });
    this.mutations.observe(view.dom, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    });
    document.fonts.addEventListener("loadingdone", this.fontsChanged);
    view.dom.addEventListener("load", this.schedule, true);
    view.dom.addEventListener("compositionend", this.schedule);
    view.dom.addEventListener("compositionstart", this.compositionStarted);
    void document.fonts.ready.then(() => {
      if (!this.destroyed) this.schedule();
    });
    this.update(view);
  }

  update(view: EditorView, previous?: EditorState) {
    this.view = view;
    const state = paginationKey.getState(view.state)!;
    const active = state.enabled && !state.layout.error;
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
      const chromeSignature = JSON.stringify([
        state.layout.pages,
        state.layout.furniture,
      ]);
      if (chromeSignature !== this.chromeSignature) {
        this.chromeSignature = chromeSignature;
        this.sheets.replaceChildren();
        for (let index = 0; index < state.layout.pages; index++) {
          const sheet = document.createElement("div");
          sheet.className = "editor-pagination-sheet";
          const number = document.createElement("span");
          number.className = "editor-pagination-number";
          number.textContent = String(index + 1);
          const top = index * (EDITOR_PAGE.height + EDITOR_PAGE.gap);
          sheet.style.top = `${top}px`;
          number.style.top = `${top + EDITOR_PAGE.height - EDITOR_PAGE.margin / 2}px`;
          this.sheets.append(sheet, number);
          if (index < state.layout.pages - 1) {
            const boundary = document.createElement("div");
            boundary.className = "editor-pagination-boundary";
            boundary.style.top = `${top + EDITOR_PAGE.height - EDITOR_PAGE.margin}px`;
            this.sheets.append(boundary);
          }
        }
        for (const item of state.layout.furniture ?? []) {
          const furniture = document.createElement("div");
          furniture.className =
            "tiptap ProseMirror editor-pagination-furniture";
          furniture.style.cssText = `top:${item.top}px;left:${item.left}px;width:${item.width}px`;
          furniture.innerHTML = item.html;
          this.sheets.append(furniture);
        }
      }
    } else {
      this.sheets.remove();
      this.chromeSignature = "";
      this.clearPageStyle();
    }
    if (!state.enabled) {
      this.signature = "";
      this.task?.abort();
      clearTimeout(this.timer);
      cancelAnimationFrame(this.frame ?? 0);
    }
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
    this.task?.abort();
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      cancelAnimationFrame(this.frame ?? 0);
      this.frame = requestAnimationFrame(() => void this.measure());
    }, 120);
  };

  private fontsChanged = () => {
    this.cache.clear();
    this.schedule();
  };

  private compositionStarted = () => {
    this.task?.abort();
    clearTimeout(this.timer);
    cancelAnimationFrame(this.frame ?? 0);
  };

  private async measure() {
    if (this.destroyed || !paginationKey.getState(this.view.state)?.enabled)
      return;
    if (this.view.composing) return;
    const width = this.view.dom.clientWidth;
    if (width !== this.width) {
      this.width = width;
      this.cache.clear();
    }
    const task = new AbortController();
    this.task?.abort();
    this.task = task;
    const doc = this.view.state.doc;
    let layout: PageLayout | null;
    try {
      layout = await measureEditor(this.view, this.cache, task.signal);
    } catch (error) {
      if (task.signal.aborted || this.destroyed) return;
      console.error("Editor pagination failed", error);
      layout = { ...emptyLayout(), error: true };
    }
    if (
      !layout ||
      task.signal.aborted ||
      this.destroyed ||
      this.view.state.doc !== doc ||
      !paginationKey.getState(this.view.state)?.enabled
    )
      return;
    const signature = JSON.stringify(layout);
    if (
      signature === this.signature &&
      !paginationKey.getState(this.view.state)?.pending
    )
      return;
    this.signature = signature;
    this.view.dispatch(
      this.view.state.tr
        .setMeta(paginationKey, { layout } satisfies PaginationUpdate)
        .setMeta("addToHistory", false),
    );
    // Discard only the synchronous DOM changes caused by our own decorations.
    this.mutations.takeRecords();
  }

  destroy() {
    this.destroyed = true;
    this.task?.abort();
    clearTimeout(this.timer);
    cancelAnimationFrame(this.frame ?? 0);
    this.resize.disconnect();
    this.mutations.disconnect();
    document.fonts.removeEventListener("loadingdone", this.fontsChanged);
    this.view.dom.removeEventListener("load", this.schedule, true);
    this.view.dom.removeEventListener("compositionend", this.schedule);
    this.view.dom.removeEventListener(
      "compositionstart",
      this.compositionStarted,
    );
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
            pending: false,
            decorations: DecorationSet.empty,
            layout: emptyLayout(),
          }),
          apply(tr, previous) {
            const update = tr.getMeta(paginationKey) as
              | PaginationUpdate
              | undefined;
            const enabled = update?.enabled ?? previous.enabled;
            const layout = enabled
              ? update?.enabled !== undefined
                ? emptyLayout()
                : (update?.layout ?? previous.layout)
              : emptyLayout();
            return {
              enabled,
              pending:
                enabled &&
                !update?.layout &&
                (update?.enabled !== undefined ||
                  tr.docChanged ||
                  previous.pending),
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
          ...paginationInputProps(paginationKey),
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
