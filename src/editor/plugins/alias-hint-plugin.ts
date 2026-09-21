import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { HighTexDB } from "../storage/hightex-db"
import { Document } from "../document"

type Abbervation = Omit<Alias, "documentId">

type AliasPluginState = {
  aliases: Abbervation[]
  decorations: DecorationSet
}

const aliasHintPluginKey = new PluginKey<AliasPluginState>("alias")

const aliasMap = new Map<string, Abbervation[]>()


export async function prefetchAlias(): Promise<void> {
  const documentId = Document.instance?.id

  if (!documentId) {
    return
  }

  const aliases = await HighTexDB
    .getInstance()
    .getAliases(documentId)

  aliasMap.set(documentId, aliases ?? [])
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function createDecorations(
  doc: ProseMirrorNode,
  aliases: Abbervation[],
): DecorationSet {
  if (!aliases.length) {
    return DecorationSet.empty
  }

  const values = new Map(
    aliases.map(alias => [alias.key, alias.value]),
  )

  const pattern = new RegExp(
    `(?<!\\w)(?:${[...aliases]
      .sort((a, b) => b.key.length - a.key.length)
      .map(alias => escapeRegExp(alias.key))
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

      decorations.push(
        Decoration.inline(
          pos + index,
          pos + index + key.length,
          {
            class: "alias",
            "data-alias": key,
            "data-value": values.get(key) ?? "",
            "data-tooltip":values.get(key)
          },
        ),
      )
    }
  })

  return DecorationSet.create(doc, decorations)
}

export function createAliasPlugin() {
  const documentId = Document.instance?.id ?? ""
  const aliases = aliasMap.get(documentId) ?? []

  console.log("[alias] plugin:", {
    documentId,
    aliases,
  })

  return new Plugin<AliasPluginState>({
    key: aliasHintPluginKey,

    state: {
      init(_, state) {
        return {
          aliases,
          decorations: createDecorations(
            state.doc,
            aliases,
          ),
        }
      },

      apply(transaction, state) {
        if (!transaction.docChanged) {
          return state
        }

        return {
          aliases: state.aliases,
          decorations: createDecorations(
            transaction.doc,
            state.aliases,
          ),
        }
      },
    },

    props: {
      decorations(state) {
        return (
          aliasHintPluginKey.getState(state)?.decorations
          ?? DecorationSet.empty
        )
      },

    },
  })
}