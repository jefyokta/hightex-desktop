import { Node, Fragment, Slice } from "@tiptap/pm/model";
import { Editor, Range } from "@tiptap/react";
import { Plugin } from "prosemirror-state";

import {
  computePosition,
  offset,
  flip,
  shift,
  autoUpdate,
  type Middleware,
} from "@floating-ui/dom";

import { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";

import { uniqId } from "../../utils/uniq-id";

export type RendererItem = {
  label: string;
  subLabel?: string;
  icon?: string;
  keywords?: string[];
  onClick: (range: Range) => any;
};

type CreateRendererOptions<T extends RendererItem> = {
  emptyText?: string;
  className?: string;

  renderItem?: (item: T, active: boolean, index: number) => string;

  header?: {
    title?: string;
    subtitle?: string;
    show?: boolean;
    className?: string;
  };

  renderHeader?: () => string;

  onSelect: (item: T, range: Range) => void;
};

export type FloatingCleanup = () => void;

export function createFloating(
  referenceRect: DOMRect,
  floatingEl: HTMLElement,
  middleware: Middleware[] = [offset(10), flip(), shift({ padding: 12 })],
): FloatingCleanup {
  return autoUpdate(document.body, floatingEl, async () => {
    const { x, y } = await computePosition(
      {
        getBoundingClientRect: () => referenceRect,
      },
      floatingEl,
      {
        placement: "bottom-start",
        middleware,
      },
    );

    Object.assign(floatingEl.style, {
      position: "absolute",
      left: `${x}px`,
      top: `${y}px`,
    });
  });
}

export const createRenderer = <T extends RendererItem>(
  options: CreateRendererOptions<T>,
) => {
  let container: HTMLDivElement;
  let header: HTMLDivElement;
  let list: HTMLDivElement;

  let cleanup: FloatingCleanup | null = null;

  let items: T[] = [];
  let selectedIndex = 0;

  const updateSelection = () => {
    const children = Array.from(list.children) as HTMLElement[];

    children.forEach((el, i) => {
      const active = i === selectedIndex;

      el.className = [
        "group relative",

        "w-full text-left",

        "rounded-md",

        "px-3 py-2",

        "transition-colors duration-100",

        "outline-none",

        "text-neutral-700",
        "dark:text-neutral-200",

        active
          ? [
              "bg-neutral-200/60",
              "dark:bg-neutral-800/70",

              "before:absolute",
              "before:left-1.5",
              "before:top-1/2",

              "before:h-4",
              "before:w-[3px]",

              "before:-translate-y-1/2",

              "before:rounded-full",
              "before:bg-neutral-400",
              "dark:before:bg-neutral-500",
            ].join(" ")
          : "",
      ].join(" ");

      if (active) {
        el.scrollIntoView({
          block: "nearest",
        });
      }
    });
  };

  const selectItem = (index: number, range: Range) => {
    const item = items[index];

    if (!item) return;

    options.onSelect(item, range);
  };

  const animateIn = () => {
    container.animate(
      [
        {
          opacity: 0,
          transform: "translateY(4px)",
        },
        {
          opacity: 1,
          transform: "translateY(0px)",
        },
      ],
      {
        duration: 120,
        easing: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    );
  };

  const renderer = {
    onStart(props: SuggestionProps) {
      items = props.items;

      selectedIndex = 0;

      container = document.createElement("div");

      container.className = [
        "absolute z-[9999]",

        "w-[400px]",
        "overflow-hidden",

        "rounded-md",

        "border border-neutral-200/80",
        "dark:border-neutral-800/80",

        "bg-neutral-50/95",
        "dark:bg-neutral-900/95",

        "backdrop-blur-md",

        "shadow-[0_10px_40px_rgba(0,0,0,0.08)]",
        "dark:shadow-[0_10px_40px_rgba(0,0,0,0.35)]",

        "transition-opacity duration-150",

        options.className || "",
      ].join(" ");

      header = document.createElement("div");

      const headerHTML =
        options.renderHeader?.() ||
        (options.header?.show !== false
          ? `
            <div
              class="
                px-3 pt-3 pb-2

                border-b border-neutral-200/70
                dark:border-neutral-800/70
              "
            >
              <div
                class="
                  text-[13px]
                  font-medium

                  text-neutral-700
                  dark:text-neutral-300
                "
              >
                ${options.header?.title || ""}
              </div>

              ${
                options.header?.subtitle
                  ? `
                    <div
                      class="
                        mt-0.5
                        text-[11px]

                        text-neutral-500
                        dark:text-neutral-500
                      "
                    >
                      ${options.header.subtitle}
                    </div>
                  `
                  : ""
              }
            </div>
          `
          : "");

      header.innerHTML = headerHTML;

      list = document.createElement("div");

      list.className = `
        flex flex-col
        gap-0.5

        p-1.5

        overflow-y-auto
        max-h-[320px]
      `;

      container.appendChild(header);
      container.appendChild(list);

      document.body.appendChild(container);

      const rect = props.clientRect?.();

      if (rect) {
        cleanup = createFloating(rect, container);
      }

      animateIn();

      renderer.onUpdate(props);
    },

    onUpdate(props: SuggestionProps) {
      items = props.items;

      if (selectedIndex >= items.length) {
        selectedIndex = 0;
      }

      list.innerHTML = "";

      if (!items.length) {
        list.innerHTML = `
          <div
            class="
              flex items-center justify-center

              py-8

              text-[12px]

              text-neutral-500
              dark:text-neutral-500
            "
          >
            ${options.emptyText || "No suggestions found"}
          </div>
        `;

        return;
      }

      items.forEach((item, i) => {
        const btn = document.createElement("button");

        btn.type = "button";

        btn.tabIndex = -1;

        btn.className = [
          "group relative",

          "w-full text-left",

          "rounded-md",

          "px-3 py-2",

          "transition-colors duration-100",

          "outline-none",

          "text-neutral-700",
          "dark:text-neutral-200",
        ].join(" ");

        btn.innerHTML =
          options.renderItem?.(item, i === selectedIndex, i) ||
          `
            <div class="flex items-center gap-3">
              ${
                item.icon
                  ? `
                    <div
                      class="
                        flex items-center justify-center

                        w-8 h-8
                        shrink-0

                        rounded-md

                        text-[15px]

                        bg-neutral-200/60
                        dark:bg-neutral-800/80
                      "
                    >
                      ${item.icon}
                    </div>
                  `
                  : ""
              }

              <div class="min-w-0 flex-1 ms-2">
                <div
                  class="
                    truncate

                    text-[13px]
                    font-medium
                  "
                >
                  ${item.label}
                </div>

                ${
                  item.subLabel
                    ? `
                      <div
                        class="
                          truncate

                          text-[11px]

                          text-neutral-500
                          dark:text-neutral-500
                        "
                      >
                        ${item.subLabel}
                      </div>
                    `
                    : ""
                }
              </div>
            </div>
          `;

        btn.onmouseenter = () => {
          selectedIndex = i;

          updateSelection();
        };

        btn.onmousedown = (e) => {
          e.preventDefault();

          selectedIndex = i;

          updateSelection();

          selectItem(i, props.range);
        };

        list.appendChild(btn);
      });

      updateSelection();
    },

    onKeyDown(props: SuggestionKeyDownProps) {
      if (!items.length) {
        return false;
      }

      const { event, range } = props;

      if (event.key === "ArrowDown") {
        event.preventDefault();

        selectedIndex = (selectedIndex + 1) % items.length;

        updateSelection();

        return true;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();

        selectedIndex = (selectedIndex - 1 + items.length) % items.length;

        updateSelection();

        return true;
      }

      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();

        selectItem(selectedIndex, range);

        return true;
      }

      if (event.key === "Escape") {
        cleanup?.();

        cleanup = null;

        container?.remove();

        return true;
      }

      return false;
    },

    onExit() {
      items = [];

      cleanup?.();

      cleanup = null;

      container?.remove();
    },
  };

  return renderer;
};

export const ensureUniqueId = (editor: Editor) => {
  const transaction = editor.state.tr;

  const seenIds = new Set<string>();

  editor.state.doc.descendants((node, pos) => {
    if (node.attrs.shouldUnique) {
      let id: string | undefined = node.attrs.id;

      if (!id || typeof id !== "string") {
        id = `${node.type.name}-${uniqId()}`;

        transaction.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          id,
        });

        seenIds.add(id);
      } else {
        if (typeof id === "string" && id.includes(":") && /^[0-9]/.test(id)) {
          const newId = `${node.type.name}.${uniqId()}`;

          transaction.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            id: newId,
          });
        }

        if (seenIds.has(id)) {
          const newId = `${node.type.name}.${uniqId()}`;

          transaction.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            id: newId,
          });

          seenIds.add(newId);

          console.warn(
            `Duplicate id found at pos ${pos}. Changed id from ${id} to ${newId}`,
          );
        } else {
          seenIds.add(id);
        }
      }
    }
  });

  if (transaction.docChanged) {
    editor.view.dispatch(transaction);
  }
};

export interface NodePasteRuleConfig {
  find: (node: Node) => boolean;

  handler: (props: { node: Node }) => Node;
}

export function NodePasteRule(config: NodePasteRuleConfig) {
  return new Plugin({
    props: {
      transformPasted(slice) {
        const fragment = mapFragment(slice.content, config);

        return new Slice(fragment, slice.openStart, slice.openEnd);
      },
    },
  });
}

const mapFragment = (fragment: Fragment, config: NodePasteRuleConfig) => {
  const children: Node[] = [];

  fragment.forEach((node) => {
    let newNode = node;

    if (config.find(node)) {
      newNode = config.handler({
        node,
      });
    }

    children.push(newNode);
  });

  return Fragment.fromArray(children);
};

export const applyHeaderGroupingClasses = (editorWrapper: HTMLElement) => {
  const tables = editorWrapper.querySelectorAll<HTMLTableElement>("table");

  tables.forEach((table) => {
    const rows = table.querySelectorAll<HTMLTableRowElement>("tr");

    rows.forEach((row) => {
      row.classList.remove("tr-group-first", "tr-group-last");
    });

    for (let i = 0; i < rows.length; i++) {
      const currentRow = rows[i];

      const isHeaderRow = currentRow.querySelector("th") !== null;

      if (isHeaderRow) {
        const previousRow = rows[i - 1];

        const previousIsHeader = previousRow
          ? previousRow.querySelector("th") !== null
          : false;

        if (i === 0 || !previousIsHeader) {
          currentRow.classList.add("tr-group-first");
        }

        const nextRow = rows[i + 1];

        const nextIsHeader = nextRow
          ? nextRow.querySelector("th") !== null
          : false;

        if (!nextRow || !nextIsHeader) {
          currentRow.classList.add("tr-group-last");
        }
      }
    }
  });
};
