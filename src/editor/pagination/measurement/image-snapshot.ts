import type { EditorView } from "@tiptap/pm/view";

/** Image identity and decoded dimensions used by a ready page plan. */
export class PageImageSnapshot {
  private readonly inputs;

  constructor(view: Pick<EditorView, "state" | "nodeDOM">) {
    const inputs: {
      image: HTMLImageElement | null;
      src: string | null;
      width: number;
      height: number;
      from: number;
      to: number;
    }[] = [];
    view.state.doc.descendants((node, position) => {
      if (node.type.name !== "image") return;
      const dom = view.nodeDOM(position);
      const image =
        dom instanceof HTMLImageElement
          ? dom
          : dom instanceof HTMLElement
            ? dom.querySelector("img")
            : null;
      inputs.push({
        image,
        src: image?.getAttribute("src") ?? null,
        width: image?.naturalWidth ?? 0,
        height: image?.naturalHeight ?? 0,
        from: position,
        to: position + node.nodeSize,
      });
    });
    this.inputs = inputs;
  }

  get images(): readonly HTMLImageElement[] {
    return this.inputs.flatMap(({ image }) => (image ? [image] : []));
  }

  get entries() {
    return this.inputs.map(({ image, from, to }) => ({ image, from, to }));
  }

  get issue():
    | { image: number; reason: "unavailable" | "changed" }
    | undefined {
    for (const [
      index,
      { image, src, width, height },
    ] of this.inputs.entries()) {
      if (!image || !src || !width || !height)
        return { image: index + 1, reason: "unavailable" };
      if (
        !image.isConnected ||
        !image.complete ||
        image.getAttribute("src") !== src ||
        image.naturalWidth !== width ||
        image.naturalHeight !== height
      )
        return { image: index + 1, reason: "changed" };
    }
  }

  isCurrent(): boolean {
    return !this.issue;
  }
}
