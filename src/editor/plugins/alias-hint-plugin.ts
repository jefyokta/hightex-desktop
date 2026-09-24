import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { AliasStorage } from "../storage/aliases"


type AliasPluginState = {
  decorations: DecorationSet
}


const aliasHintPluginKey = new PluginKey<AliasPluginState>("alias")

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function createDecorations(
  doc: ProseMirrorNode,
): DecorationSet {
  const aliases = AliasStorage.instance
  if(aliases.isEmpty()){
    return DecorationSet.empty
  }

  const keys = [...aliases.keys()]

    const pattern = new RegExp(
      `(?<!\\w)(?:${keys
        .sort((a, b) => b.length - a.length)
        .map(escapeRegExp)
        .join("|")})(?!\\w)`,
      "g",
    )

 const decorations: Decoration[] = []

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) {
      return
    }

    for (const match of node.text.matchAll(pattern)) {
      const index = match.index!
      const key = match[0]
      const value = aliases.get(key)

      decorations.push(
        Decoration.inline(
          pos + index,
          pos + index + key.length,
          {
            class: "alias",
            "data-alias": key,
            "data-value": value ?? "",
            "data-tooltip": value ?? "",
          },
        ),
      )
    }
  })

  return DecorationSet.create(doc, decorations)
}
export function createAliasPlugin() {
  return new Plugin<AliasPluginState>({
    key: aliasHintPluginKey,

    state: {
      init(_, state) {
        return {
          decorations: createDecorations(state.doc),
        }
      },

      apply(transaction, state) {
        if (!transaction.docChanged) {
          return state
        }

        return {
          decorations: createDecorations(transaction.doc),
        }
      },
    },

    props: {
      decorations(state) {
        return (
          createDecorations(state.doc)
         
        )
      },
    },
  })
}