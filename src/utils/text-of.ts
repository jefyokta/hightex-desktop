type TextNode = {
  type?: string;
  text?: string;
  content?: TextNode[];
};

type TextOfOptions = {
  preserveBlockBreaks?: boolean;
};

export const textOf = (
  node: TextNode | TextNode[] | undefined,
  options: TextOfOptions = {},
): string => {
  const nodes = Array.isArray(node) ? node : node ? [node] : [];
  return nodes
    .map((n) => {
      if (n.type === "text") return n.text ?? "";
      if (options.preserveBlockBreaks && n.type === "hardBreak") return "\n";

      const text = textOf(n.content, options);
      return options.preserveBlockBreaks &&
        ["paragraph", "heading", "listItem", "tableRow"].includes(
          n.type ?? "",
        )
        ? `${text}\n`
        : text;
    })
    .join("")
    .trim();
};
