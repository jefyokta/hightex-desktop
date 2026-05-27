export default (() => {
  //@ts-ignore
  const storage = typeof db !== "undefined" ? db : {};

  if (!storage.images) {
    storage.images = {
      declared: {},
      referenced: {},
    };
    storage.tables = {
      declared: {},
      referenced: {},
    };
  }

  return {
    id: "reference",
    version: "1.0.0",

    scanner: {
      onNode(node, ctx) {
        const { chapterId, isEndOfScan, isLastChapter } = ctx.scanner;

        if (node.type === "imageFigure" && node.attrs?.id) {
          storage.images.declared[node.attrs.id] = chapterId;
        }

        if (node.type === "figureTable" && node.attrs?.id) {
          storage.tables.declared[node.attrs.id] = chapterId;
        }

        if (node.type === "ref" || node.type === "refComponent") {
          const targetId = node.attrs?.link;
          const refType = node.attrs?.ref;

          if (targetId) {
            if (refType === "imageFigure")
              storage.images.referenced[targetId] = true;
            if (refType === "figureTable")
              storage.tables.referenced[targetId] = true;
          }
        }

        const isFinalNode = isEndOfScan && isLastChapter;

        if (!isFinalNode) return;

        for (const id in storage.images.declared) {
          if (!storage.images.referenced[id]) {
            ctx.addError({
              chapterId: storage.images.declared[id],
              name: "image",
              id: id,
              description: `Image "${id}" declared, but never referenced`,
            });
          }
        }

        for (const id in storage.tables.declared) {
          if (!storage.tables.referenced[id]) {
            ctx.addError({
              chapterId: storage.tables.declared[id],
              name: "table",
              id: id,
              description: `Table "${id}" declared, but never referenced`,
            });
          }
        }
        storage.images = { declared: {}, referenced: {} };
        storage.tables = { declared: {}, referenced: {} };
      },
    },
  };
})() satisfies HightexPlugin;
