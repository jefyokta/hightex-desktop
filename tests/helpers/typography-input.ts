import type { JSONContent } from "@tiptap/core";
import type { Node } from "@tiptap/pm/model";
import { Transform } from "@tiptap/pm/transform";

export function insertTypographyBoundary(source: Node, position: number) {
  return new Transform(source).insert(position, source.type.schema.nodes.hardBreak.create()).doc;
}

export function typographyInput(sentence: string): JSONContent {
  const text = (value: string, marks?: JSONContent["marks"]): JSONContent => ({ type: "text", text: value, marks });
  const paragraph = (value: string): JSONContent => ({ type: "paragraph", content: [text(value)] });
  return { type: "doc", content: [
    { type: "heading", attrs: { level: 1 }, content: [text("Introduction")] },
    { type: "paragraph", content: [text("BR pendek sebelum baris baru"), { type: "hardBreak" }, text(sentence.repeat(100))] },
    paragraph("Ligatures office affinity ffi fl; combining café café. " + sentence.repeat(4)),
    paragraph("العربية 123 English العربية 456. ".repeat(16)),
    { type: "paragraph", content: [text("Tebal ", [{ type: "bold" }]), text("miring ", [{ type: "italic" }]), text("PROOFLINK", [{ type: "link", attrs: { href: "https://example.com/representation-proof", target: "_blank" } }]), text(" akhir.")] },
  ] };
}
