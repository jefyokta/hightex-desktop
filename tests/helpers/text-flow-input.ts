import type { JSONContent } from "@tiptap/core";

/** One bounded source exercising authored breaks and continued, nested lists. */
export function textFlowInput(variant = "flow"): JSONContent[] {
  const sentence = "Pemenggalan menjaga isi dan urutan paragraf tanpa mengubah sumber. ";
  const text = (value: string): JSONContent => ({ type: "text", text: value });
  const br = (): JSONContent => ({ type: "hardBreak" });
  const p = (...content: JSONContent[]): JSONContent => ({ type: "paragraph", content });
  const item = (...content: JSONContent[]): JSONContent => ({ type: "listItem", content });
  if (variant === "rules") {
    const lines = (count: number, label: string) => p(...Array.from({ length: count }, (_, index) =>
      [text(`${label} baris ${index + 1}.`), ...(index < count - 1 ? [br()] : [])]).flat());
    return [
      { type: "horizontalRule" }, lines(34, "Pengantar widow"), lines(4, "Paragraf widow"),
      { type: "horizontalRule" }, lines(36, "Pengantar orphan"), lines(6, "Paragraf orphan"),
      { type: "horizontalRule" }, lines(35, "Pengantar heading"),
      { type: "heading", attrs: { level: 2 }, content: [text("Heading pada batas halaman")] },
      lines(6, "Isi sesudah heading"),
      p({ type: "text", text: "Tebal office ffi. ", marks: [{ type: "bold" }] },
        { type: "text", text: "Miring café café. ", marks: [{ type: "italic" }] },
        { type: "text", text: "Garis bawah. ", marks: [{ type: "underline" }] },
        { type: "text", text: "Tautan aktif.", marks: [{ type: "link", attrs: { href: "https://example.com" } }] }),
    ];
  }
  return [
    p(text("Baris pendek sebelum Shift Enter."), br(), text(sentence.repeat(60)), br(), br(), text("Setelah dua BR.")),
    p(), p(),
    { type: "orderedList", attrs: { start: 7 }, content: [
      item(p(br(), text("Awal item dengan BR. "+sentence.repeat(45)), br(), text("Baris pendek akhir."), br()),
        { type: "orderedList", attrs: { start: 3 }, content: [
          item(p(text("Nested c. "+sentence.repeat(4)))),
          item(p(text("Nested d."), br(), br(), text("Setelah blank line nested."))),
        ] }),
      item(p(text("Item delapan. "+sentence.repeat(4))), p(text("Paragraf kedua dalam item yang sama."))),
    ] },
    { type: "bulletList", content: [item(p(text("Bullet pertama."))), item(p(text("Bullet kedua.")))] },
    { type: "heading", attrs: { level: 2 }, content: [text("Heading harus mengikuti isi berikutnya")] },
    p(text(sentence.repeat(7))),
    { type: "horizontalRule" },
    p(text("Setelah forced break."), br(), text("Akhir pendek.")),
  ];
}
