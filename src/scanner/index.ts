import { JSONContent } from "@tiptap/core";

export class Scanner {
  private static plugins: SerialableHightexPlugin[] = [];
  private textErrors: TextError[] = [];

  static async init() {
    this.plugins = await window.plugin.scanner.all();
    await window.ipcRenderer.invoke("plugin:start");
  }

  async scan(
    root: JSONContent | JSONContent[],
    chapterId: string,
    isLastChapter = false,
  ) {
    const nodeErrors: NodeError[] = [];

    await this.walk(
      root,
      {
        chapterId,
        index: 0,
        path: [],
        node: Array.isArray(root) ? { type: "doc", content: root } : root,
        root,
        isLastChapter,
      },
      nodeErrors,
    );

    return nodeErrors;
  }

  private async walk(
    node: JSONContent | JSONContent[],
    ctx: Omit<ScannerContext, "isEndOfScan">,
    nodeErrors: NodeError[],
  ) {
    const content = Array.isArray(node) ? node : (node?.content ?? []);

    for (let index = 0; index < content.length; index++) {
      const current = content[index];

      const isLastNodeInContent = index === content.length - 1;
      const hasNoMoreNestedContent =
        !current.content || current.content.length === 0;
      1;
      const isEndOfScan =
        ctx.isLastChapter && isLastNodeInContent && hasNoMoreNestedContent;

      const nextContext: ScannerContext = {
        chapterId: ctx.chapterId,
        index,
        path: [...ctx.path, index],
        node: current,
        root: ctx.root,
        isLastChapter: ctx.isLastChapter,
        isEndOfScan: isEndOfScan,
      };

      const nodeResults = await Promise.all(
        Scanner.plugins
          .filter((p) => p.scanner?.hasOnNode)
          .map((plugin) =>
            window.plugin.scanner.node(plugin.id, current, nextContext),
          ),
      );

      for (const res of nodeResults) {
        if (res?.length) nodeErrors.push(...res);
      }

      if (current.type === "paragraph") {
        const text = this.renderText(current.content);

        const paragraphResults = await Promise.all(
          Scanner.plugins
            .filter((p) => p.scanner?.hasOnParagraph)
            .map((plugin) =>
              window.plugin.scanner.paragraph(plugin.id, text, nextContext),
            ),
        );

        for (const res of paragraphResults) {
          if (res?.length) {
            this.textErrors.push(...res);
          }
        }
      }

      if (current.content?.length) {
        await this.walk(current.content, nextContext, nodeErrors);
      }
    }
  }

  getTextErrors() {
    return this.textErrors;
  }

  async getNodeErrors(
    root: JSONContent | JSONContent[],
    chapterId: string,
    isLastChapter = false,
  ) {
    return this.scan(root, chapterId, isLastChapter);
  }

  isOk() {
    return this.textErrors.length === 0;
  }

  destroy() {
    this.textErrors = [];
  }

  renderText(content: JSONContent[] = []) {
    let text = "";
    for (const node of content) {
      if (node.type === "text") {
        text += node.text || "";
        continue;
      }
      if (node.type === "hardBreak") {
        text += "\n";
        continue;
      }
      text += `[${node.type}]`;
    }
    return text;
  }
}
