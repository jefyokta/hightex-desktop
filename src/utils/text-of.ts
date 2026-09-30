import { JSONContent } from "@tiptap/core"

export const textOf = (node: JSONContent | JSONContent[] | undefined): string => {
    const nodes = Array.isArray(node) ? node : node ? [node] : []
    return nodes
        .map((n) => (n.type === "text" ? n.text ?? "" : textOf(n.content)))
        .join("")
        .trim()
}