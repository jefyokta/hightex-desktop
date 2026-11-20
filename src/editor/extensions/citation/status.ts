import type { EditorView } from "@tiptap/pm/view";

export function citationElement(
  view: Pick<EditorView, "nodeDOM">,
  position: number,
): HTMLElement | null {
  const dom = view.nodeDOM(position);
  return dom instanceof HTMLElement
    ? dom.matches("cite")
      ? dom
      : dom.querySelector("cite")
    : null;
}

/** Read the live source's citation status; never treat a loading label as final content. */
export function citationStatus(view: Pick<EditorView, "state" | "nodeDOM">) {
  let loading = false,
    error: number | undefined,
    ordinal = 0;
  view.state.doc.descendants((node, position) => {
    if (node.type.name !== "cite") return;
    ordinal++;
    const cite = citationElement(view, position);
    if (!cite || cite.dataset.citationStatus === "loading" || !cite.textContent)
      loading = true;
    if (cite?.dataset.citationStatus === "error") error ??= ordinal;
  });
  return { loading, error };
}
