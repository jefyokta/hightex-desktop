import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export interface SearchReplaceStorage {
  searchTerm: string;
  caseSensitive: boolean;
  results: { from: number; to: number }[];
  currentIndex: number;
}

export const searchReplacePluginKey = new PluginKey("searchReplace");

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    searchReplace: {
      setSearchTerm: (term: string) => ReturnType;
      setCaseSensitive: (value: boolean) => ReturnType;
      nextSearchResult: () => ReturnType;
      previousSearchResult: () => ReturnType;
      replaceCurrentResult: (replacement: string) => ReturnType;
      replaceAllResults: (replacement: string) => ReturnType;
      clearSearch: () => ReturnType;
    };
  }
}

function findMatches(
  doc: any,
  searchTerm: string,
  caseSensitive: boolean,
): { from: number; to: number }[] {
  const results: { from: number; to: number }[] = [];

  if (!searchTerm || !doc) return results;

  const term = caseSensitive ? searchTerm : searchTerm.toLowerCase();

  doc.descendants((node: any, pos: number) => {
    if (!node.isText || !node.text) return;

    const text = caseSensitive ? node.text : node.text.toLowerCase();
    let index = 0;

    while (index < text.length) {
      const found = text.indexOf(term, index);
      if (found === -1) break;

      results.push({
        from: pos + found,
        to: pos + found + term.length,
      });

      index = found + 1;
    }
  });

  return results;
}

function createDecorations(
  doc: any,
  storage: SearchReplaceStorage,
): DecorationSet {
  const { searchTerm, results, currentIndex } = storage;

  if (!searchTerm || results.length === 0 || !doc) {
    return DecorationSet.empty;
  }

  const decorations: Decoration[] = [];
  const docSize = doc.content.size;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];

    // Validate positions against current document bounds
    if (result.from < 0 || result.to > docSize || result.from >= result.to) {
      continue;
    }

    const className =
      i === currentIndex ? "search-highlight-active" : "search-highlight";

    decorations.push(
      Decoration.inline(result.from, result.to, {
        class: className,
      }),
    );
  }

  return DecorationSet.create(doc, decorations);
}

function scrollToResult(
  editor: any,
  result: { from: number; to: number },
): void {
  try {
    if (!editor?.view?.coordsAtPos) return;
    const coords = editor.view.coordsAtPos(result.from);
    const mainScroll = document.getElementById("main-scroll");

    if (mainScroll && coords) {
      const scrollRect = mainScroll.getBoundingClientRect();
      const targetY = coords.top - scrollRect.top + mainScroll.scrollTop - 120;

      mainScroll.scrollTo({
        top: targetY,
        behavior: "smooth",
      });
    }
  } catch {
    // Position might be out of range, ignore safely
  }
}

export const SearchReplace = Extension.create<object, SearchReplaceStorage>({
  name: "searchReplace",

  addStorage() {
    return {
      searchTerm: "",
      caseSensitive: false,
      results: [],
      currentIndex: -1,
    };
  },

  addCommands() {
    return {
      setSearchTerm:
        (term: string) =>
        ({ tr, dispatch, editor }) => {
          const s = this.storage;
          s.searchTerm = term;
          s.results = findMatches(tr.doc, term, s.caseSensitive);
          s.currentIndex = s.results.length > 0 ? 0 : -1;

          if (dispatch) {
            tr.setMeta(searchReplacePluginKey, { type: "setSearchTerm" });
          }

          if (s.results.length > 0) {
            requestAnimationFrame(() => {
              scrollToResult(editor, s.results[0]);
            });
          }

          return true;
        },

      setCaseSensitive:
        (value: boolean) =>
        ({ tr, dispatch, editor }) => {
          const s = this.storage;
          s.caseSensitive = value;
          s.results = findMatches(tr.doc, s.searchTerm, value);
          s.currentIndex = s.results.length > 0 ? 0 : -1;

          if (dispatch) {
            tr.setMeta(searchReplacePluginKey, { type: "setCaseSensitive" });
          }

          if (s.results.length > 0) {
            requestAnimationFrame(() => {
              scrollToResult(editor, s.results[0]);
            });
          }

          return true;
        },

      nextSearchResult:
        () =>
        ({ tr, dispatch, editor }) => {
          const s = this.storage;
          if (s.results.length === 0) return false;

          s.currentIndex = (s.currentIndex + 1) % s.results.length;

          if (dispatch) {
            tr.setMeta(searchReplacePluginKey, { type: "next" });
          }

          const target = s.results[s.currentIndex];
          if (target) {
            requestAnimationFrame(() => {
              scrollToResult(editor, target);
            });
          }

          return true;
        },

      previousSearchResult:
        () =>
        ({ tr, dispatch, editor }) => {
          const s = this.storage;
          if (s.results.length === 0) return false;

          s.currentIndex =
            (s.currentIndex - 1 + s.results.length) % s.results.length;

          if (dispatch) {
            tr.setMeta(searchReplacePluginKey, { type: "previous" });
          }

          const target = s.results[s.currentIndex];
          if (target) {
            requestAnimationFrame(() => {
              scrollToResult(editor, target);
            });
          }

          return true;
        },

      replaceCurrentResult:
        (replacement: string) =>
        ({ tr, dispatch, editor }) => {
          const s = this.storage;
          if (s.results.length === 0 || s.currentIndex < 0) return false;

          const result = s.results[s.currentIndex];
          if (
            result.from > tr.doc.content.size ||
            result.to > tr.doc.content.size
          ) {
            return false;
          }

          const savedIndex = s.currentIndex;

          if (dispatch) {
            tr.insertText(replacement, result.from, result.to);
            const newResults = findMatches(
              tr.doc,
              s.searchTerm,
              s.caseSensitive,
            );
            s.results = newResults;
            if (newResults.length === 0) {
              s.currentIndex = -1;
            } else {
              s.currentIndex =
                savedIndex >= newResults.length ? 0 : savedIndex;
            }
            tr.setMeta(searchReplacePluginKey, { type: "replace" });

            if (newResults.length > 0 && s.currentIndex >= 0) {
              const target = newResults[s.currentIndex];
              requestAnimationFrame(() => {
                scrollToResult(editor, target);
              });
            }
          }

          return true;
        },

      replaceAllResults:
        (replacement: string) =>
        ({ tr, dispatch }) => {
          const s = this.storage;
          if (s.results.length === 0) return false;

          if (dispatch) {
            const sorted = [...s.results].sort((a, b) => b.from - a.from);
            for (const result of sorted) {
              if (
                result.from <= tr.doc.content.size &&
                result.to <= tr.doc.content.size
              ) {
                tr.insertText(replacement, result.from, result.to);
              }
            }

            const newResults = findMatches(
              tr.doc,
              s.searchTerm,
              s.caseSensitive,
            );
            s.results = newResults;
            s.currentIndex = newResults.length > 0 ? 0 : -1;
            tr.setMeta(searchReplacePluginKey, { type: "replaceAll" });
          }

          return true;
        },

      clearSearch:
        () =>
        ({ tr, dispatch }) => {
          const s = this.storage;
          if (!s.searchTerm && s.results.length === 0) {
            return true;
          }

          s.searchTerm = "";
          s.results = [];
          s.currentIndex = -1;

          if (dispatch) {
            tr.setMeta(searchReplacePluginKey, { type: "clear" });
          }

          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const extensionThis = this;

    return [
      new Plugin({
        key: searchReplacePluginKey,
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(tr, oldSet, _oldState, newState) {
            const meta = tr.getMeta(searchReplacePluginKey);
            const s = extensionThis.storage;

            // Explicit search/replace meta event
            if (meta) {
              return createDecorations(newState.doc, s);
            }

            // External doc change while search is active
            if (tr.docChanged && s.searchTerm) {
              s.results = findMatches(
                newState.doc,
                s.searchTerm,
                s.caseSensitive,
              );
              if (s.results.length === 0) {
                s.currentIndex = -1;
              } else if (s.currentIndex >= s.results.length) {
                s.currentIndex = 0;
              }
              return createDecorations(newState.doc, s);
            }

            if (tr.docChanged) {
              return oldSet.map(tr.mapping, tr.doc);
            }

            return oldSet;
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});
