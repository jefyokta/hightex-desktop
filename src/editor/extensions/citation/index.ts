import { Node } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import { ReactNodeViewRenderer } from "@tiptap/react";
import Suggestion, {
  SuggestionKeyDownProps,
  SuggestionProps,
} from "@tiptap/suggestion";
import { bibToObject, CiteUtils } from "bibtex.js";
import { Citation } from "./citation";

import { HighTexDB } from "../../storage/hightex-db";

type CiteOptions = {
  cite: string;
  citeA?: boolean;
};

export const Cite = Node.create<CiteOptions>({
  name: "cite",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      cite: {
        default: "",
        parseHTML: (element) => element.getAttribute("cite") || "",
        renderHTML: (attributes) => ({ cite: attributes.cite }),
      },
      citeA: {
        default: false,
        parseHTML: (element) => element.hasAttribute("citeA"),
        renderHTML: (attributes) => (attributes.citeA ? { citeA: "true" } : {}),
      },
      manual: {
        default: false,
      },
      text: {
        default: "",
      },
      year: {
        default: "",
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "cite[cite]",
        attrs: {
          cite: this.options.cite,
          citeA: this.options.citeA,
        },
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", HTMLAttributes, 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(Citation);
  },

  addCommands(): any {
    return {
      insertCitation:
        (opt: CiteOptions) =>
        ({ commands }: any) => {
          return commands.insertContent({
            type: this.name,
            attrs: { cite: opt.cite, citeA: opt.citeA || false },
          });
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion<CiteUtils, CiteUtils>({
        char: "@",
        pluginKey: new PluginKey("citation-suggestion"),

        items: async ({ query }) => {
          const cite = await HighTexDB.getInstance().cite.toArray();
          if (!cite) {
            return [];
          }
          return cite
            .map(({ key, bib }) => {
              const obj = bibToObject(bib)[0];
              return new CiteUtils(obj).setId(key);
            })
            .filter((c) => {
              const title = c.getTitle() as string;
              return title.toLowerCase().includes(query.toLowerCase());
            });
        },

        command({ editor, range, props }) {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent({
              type: "cite",
              attrs: {
                citeA: false,
                cite: props.getId(),
              },
            })
            .run();
        },

        render: () => createRenderer({ citeA: false }),
        editor: this.editor,
      }),

      Suggestion<CiteUtils, CiteUtils>({
        char: "#",
        pluginKey: new PluginKey("citation-a-suggestion"),

        items: async ({ query }) => {
          const cite = await HighTexDB.getInstance().cite.toArray();
          if (!cite) {
            return [];
          }
          return cite
            .map(({ key, bib }) => {
              const obj = bibToObject(bib)[0];
              return new CiteUtils(obj).setId(key);
            })
            .filter((c) => {
              const title = c.getTitle() as string;
              return title.toLowerCase().includes(query.toLowerCase());
            });
        },

        command({ editor, range, props }) {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent({
              type: "cite",
              attrs: {
                citeA: true,
                cite: props.getId(),
              },
            })
            .run();
        },

        render: () => createRenderer({ citeA: true }),
        editor: this.editor,
      }),
    ];
  },
});

const createRenderer = ({ citeA }: { citeA: boolean }) => {
  let container: HTMLDivElement;
  let header: HTMLHeadingElement;
  let list: HTMLUListElement;
  let selectedIndex = 0;
  let items: any[] = [];

  const updateSelection = () => {
    const children = Array.from(list.children) as HTMLElement[];

    children.forEach((el, i) => {
      el.classList.toggle("bg-neutral-100", i === selectedIndex);
    });

    children[selectedIndex]?.scrollIntoView({
      block: "nearest",
    });
  };

  const selectItem = (props: any) => {
    const item = items[selectedIndex];
    if (!item) return;
    props.command(item);
  };

  const renderer = {
    onStart: (props: SuggestionProps) => {
      container = document.createElement("div");
      container.classList.add(
        "bg-white",
        "rounded-xl",
        "border",
        "shadow",
        "absolute",
        "w-96",
        "max-h-56",
        "overflow-y-auto",
        "pb-5",
      );
      container.style.zIndex = "9999";

      const inner = document.createElement("div");
      inner.classList.add("w-full", "h-full", "relative");

      header = document.createElement("div");
      header.classList.add(
        "font-bold",
        "mb-2",
        "text-sm",
        "sticky",
        "top-0",
        "bg-white",
        "p-3",
        "border-b",
      );
      header.textContent = citeA ? "Cite Author" : "Cite";

      list = document.createElement("ul");
      list.classList.add("space-y-3", "w-full", "px-3");

      inner.append(header, list);
      container.append(inner);

      const rect = props.clientRect?.();
      if (rect) {
        container.style.left = `${rect.left}px`;
        container.style.top = `${rect.bottom + window.scrollY}px`;
      }

      document.body.appendChild(container);
      renderer.onUpdate(props);
    },

    onUpdate: (props: any) => {
      items = props.items;
      selectedIndex = 0;

      const rect = props.clientRect?.();
      if (rect) {
        container.style.left = `${rect.left}px`;
        container.style.top = `${rect.bottom + window.scrollY}px`;
      }

      list.innerHTML = "";

      items.forEach((item: any, i: number) => {
        const li = createList({
          cite: item,
          command: props.command,
          citeA,
        });

        li.tabIndex = -1;
        li.classList.add(
          "transition-colors",
          i === selectedIndex ? "bg-neutral-100" : "hover:bg-neutral-100",
        );

        li.onmousedown = (e) => {
          e.preventDefault();
          selectedIndex = i;
          updateSelection();
          props.command(item);
        };

        list.appendChild(li);
      });

      updateSelection();
    },

    onKeyDown: (props: SuggestionKeyDownProps) => {
      if (!items.length) return false;

      const { event } = props;

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
        selectItem(props);
        return true;
      }

      if (event.key === "Escape") {
        container?.remove();
        return true;
      }

      return false;
    },

    onExit: () => {
      items = [];
      container?.remove();
    },
  };

  return renderer;
};

type ListItemProps = {
  cite: CiteUtils;
  command: (props: any) => void;
  citeA?: boolean;
};

const createList = ({ cite, command, citeA }: ListItemProps): HTMLLIElement => {
  const li = document.createElement("li");
  const titleEl = document.createElement("p");

  titleEl.classList.add("truncate", "max-w-full");
  const authorEl = document.createElement("p");

  titleEl.textContent = cite.getTitle();
  authorEl.textContent = citeA ? cite.toCiteA() : cite.toCite();

  authorEl.classList.add("text-xs", "text-gray-500");
  titleEl.classList.add("font-medium");

  li.classList.add(
    "text-sm",
    "px-2",
    "py-1",
    "cursor-pointer",
    "hover:bg-gray-100",
    "rounded",
  );

  li.onclick = () => {
    command(cite);
  };

  li.append(titleEl, authorEl);

  return li;
};
