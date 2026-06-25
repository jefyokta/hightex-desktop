// electron/plugins/default/abstract/index.ts
var storage = db ? db : {};
if (!storage.abstract) {
  storage.abstract = { words: [], errorAdded: false };
}
if (!storage["abstract-en"]) {
  storage["abstract-en"] = { words: [], errorAdded: false };
}
var abstract_default = {
  id: "abstract",
  version: "1.0.0",
  scanner: {
    onNode(node, ctx) {
      const { isEndOfScan } = ctx.scanner;
      const chapter = ctx.scanner.chapterId.split(".")[1] || "";
      if (node.type !== "paragraph") {
        return;
      }
      if (chapter == "abstract") {
        const text = node.content?.map((n) => n.text || "").join("") || "";
        storage.abstract.words.push(...text.split(" ").filter(Boolean));
        if (storage.abstract.words.length > 200 && !storage.abstract.errorAdded) {
          ctx.addError({
            chapterId: ctx.scanner.chapterId,
            name: "Too much words!",
            id: "abstract-error",
            description: "Abstrak should only had max 200 words"
          });
          storage.abstract.errorAdded = true;
        }
      }
      if (chapter == "abstract-en") {
        if (storage["abstract-en"].words.length > 200 && !storage["abstract-en"].errorAdded) {
          ctx.addError({
            chapterId: ctx.scanner.chapterId,
            name: "Too much words!",
            id: "abstract-error",
            description: "Abstrak should only had max 200 words"
          });
          storage["abstract-en"].errorAdded = true;
        }
      }
      if (isEndOfScan && !node.content) {
        storage["abstract-en"] = { words: [], errorAdded: false };
        storage["abstract"] = { words: [], errorAdded: false };
      }
    }
  }
};
export {
  abstract_default as default
};
