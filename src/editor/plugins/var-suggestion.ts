import { HighTexDB } from "@/editor/storage/hightex-db";
import { Editor } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import { Range } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import { Document } from "../document";
import { createRenderer } from "../extensions/utilites";
import { truncate } from "@/utils/truncate";
import { applyCase } from "@/utils/apply-var-case";

export const VariableSuggestionPluginKey = new PluginKey("variableSuggestion");

type VariableItem = {
  label: string;
  subLabel?: string;
  onClick: (range: Range) => void;
};

const CASES = ["preserve", "upper", "lower", "capitalize", "title"] as const;

const QUERY_REGEX = /^[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z]*)?$/;

function score(name: string, keyword: string) {
  const n = name.toLowerCase();
  const k = keyword.toLowerCase();

  if (!k) return 1;
  if (n === k) return 100;
  if (n.startsWith(k)) return 75;
  if (n.includes(k)) return 50;
  return 0;
}

async function searchVariables(
  query: string,
  editor: Editor,
): Promise<VariableItem[]> {
  if (!Document.instance) return [];

  const [rawName = "", rawCase] = query.split(".", 2);
  const keyword = rawName.toLowerCase();

  const variables = await HighTexDB.getInstance().getVars(Document.instance.id);

  return variables
    .map((v) => ({
      v,
      score: score(v.name, keyword),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.v)
    .flatMap((v) => {
      const baseValue = v.value ?? "";

      const modes =
        rawCase === undefined
          ? CASES
          : CASES.filter((c) => c.startsWith(rawCase.toLowerCase()));

      return modes.map((mode) => ({
        label: mode === "preserve" ? v.name : `${v.name}.${mode}`,

        subLabel: truncate(applyCase(baseValue, mode)),

        onClick(range: Range) {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent({
              type: "variable",
              attrs: {
                name: v.name,
                case: mode,
              },
            })
            .run();
        },
      }));
    });
}

export const VariableSuggestion = (editor: Editor) =>
  Suggestion<VariableItem>({
    editor,

    pluginKey: VariableSuggestionPluginKey,

    char: "\\",

    allowSpaces: false,

    startOfLine: false,

    allow({ state, range }) {
      const $from = state.doc.resolve(range.from);
      return $from.parent.isTextblock;
    },

    shouldShow({ query }) {
      if (query.length == 0) {
        return false;
      }
      return QUERY_REGEX.test(query);
    },

    items: ({ query }) => searchVariables(query, editor),

    render() {
      return createRenderer({
        header: {
          title: "Variables",
          subtitle: "Insert document variable",
        },

        onSelect(item, range) {
          item.onClick(range);
        },
      });
    },
  });
