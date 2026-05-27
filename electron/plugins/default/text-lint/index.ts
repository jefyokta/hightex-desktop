export default {
  id: "text-lint",
  version: "1.0.0",

  scanner: {
    onParagraph(text, ctx) {
      if (text.includes("  ")) {
        ctx.addError({
          chapterId: ctx.scanner.chapterId,
          name: "text",
          title: "Double space",
          description: "Found multiple consecutive spaces",
          text,
          match: /  /,
        });
      }

      if (/\s+[.,!?;]/.test(text)) {
        ctx.addError({
          chapterId: ctx.scanner.chapterId,
          name: "text",
          title: "Space before punctuation",
          description: "Invalid spacing before punctuation",
          text,
          match: /\s+[.,!?;]/,
        });
      }

      if (/\s+$/.test(text)) {
        ctx.addError({
          chapterId: ctx.scanner.chapterId,
          name: "text",
          title: "Trailing whitespace",
          description: "Line ends with whitespace",
          text,
          match: /\s+$/,
        });
      }
    },
  },
} satisfies HightexPlugin;
