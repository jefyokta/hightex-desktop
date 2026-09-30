import type { JSONContent } from "@tiptap/core";
import { textOf } from "@/utils/text-of";
import { definePlugin } from "./types";

const CONTEXT = 30; 
const FILL = "▮"; 
const SKIP_NODES = new Set(["codeBlock"]);

export type PunctuationIssue = {
  chapter: { index: number; title: string; id: string };
  paragraph: number;
  message: string;
  excerpt: { before: string; match: string; after: string };
};

type Rule = { pattern: RegExp; message: (m: string) => string };

const rules: Rule[] = [
  { pattern: / {2,}/g, message: () => "Spasi ganda" },
  {
    pattern: /\s+[,.;:!?]/g,
    message: (m) => `Ada spasi sebelum tanda baca "${m.trim()}"`,
  },
  {
    pattern: /[,;:](?=\p{L})/gu,
    message: (m) => `Tidak ada spasi setelah "${m}"`,
  },
  { pattern: /([,;:!?])\1+/g, message: (m) => `Tanda baca berulang "${m}"` },
  {
    pattern: /(?<!\.)\.\.(?!\.)|\.{4,}/g,
    message: (m) => `Jumlah titik tidak wajar "${m}"`,
  },
];

type Paragraph = { text: string; checkable: string }; 

function paragraphOf(node: JSONContent): Paragraph {
  let text = "";
  let checkable = "";

  for (const child of node.content ?? []) {
    if (child.type === "text") {
      const raw = child.text ?? "";
      const isCode = child.marks?.some((m) => m.type === "code");
      text += raw;
      checkable += isCode ? FILL.repeat(raw.length) : raw;
    } else if (child.type === "hardBreak") {
      text += "\n";
      checkable += "\n";
    } else {
      const raw = textOf(child);
      text += raw;
      checkable += FILL.repeat(raw.length);
    }
  }

  const start = text.length - text.trimStart().length;
  const end = text.trimEnd().length;
  return { text: text.slice(start, end), checkable: checkable.slice(start, end) };
}

function collectParagraphs(nodes: JSONContent[], out: Paragraph[] = []): Paragraph[] {
  for (const node of nodes) {
    if (node.type && SKIP_NODES.has(node.type)) continue;

    if (node.type === "paragraph") out.push(paragraphOf(node));
    else if (node.content?.length) collectParagraphs(node.content, out);
  }
  return out;
}

function excerptOf(text: string, index: number, length: number) {
  const start = Math.max(0, index - CONTEXT);
  const end = Math.min(text.length, index + length + CONTEXT);

  return {
    before: (start > 0 ? "…" : "") + text.slice(start, index),
    match: text.slice(index, index + length),
    after: text.slice(index + length, end) + (end < text.length ? "…" : ""),
  };
}

export const punctuation = definePlugin({
  id: "punctuation",
  label: "Tanda baca",

  async run(ctx) {
    const issues: PunctuationIssue[] = [];

    ctx.chapters.forEach(({ id, title }, ci) => {
      const chapter = { index: ci + 1, title, id };
      const paragraphs = collectParagraphs(ctx.contents[id] ?? []);

      paragraphs.forEach(({ text, checkable }, pi) => {
        if (!text) return;

        for (const rule of rules) {
          for (const m of checkable.matchAll(rule.pattern)) {
            issues.push({
              chapter,
              paragraph: pi + 1,
              message: rule.message(m[0]),
              excerpt: excerptOf(text, m.index, m[0].length), 
            });
          }
        }
      });
    });

    return issues;
  },
});