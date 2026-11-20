export function assertSupportedContent(content: unknown): void {
  for (const node of Array.isArray(content)
    ? content
    : content
      ? [content]
      : []) {
    if (!node || typeof node !== "object") continue;
    if ("type" in node && node.type === "blockquote")
      throw new RangeError("Unsupported document node: blockquote");
    if ("content" in node) assertSupportedContent(node.content);
  }
}
