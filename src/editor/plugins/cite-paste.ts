import { Plugin, PluginKey } from "@tiptap/pm/state";

export const CitePaste = new Plugin({
  key: new PluginKey("citePaste"),

  props: {
    handlePaste(view, event) {
      const text = event.clipboardData?.getData("text/plain") || "";

      const trimmed = text.trim();

      const regex = /^\\cite\.(a|n)\.([a-zA-Z0-9_-]+)$/;

      const match = trimmed.match(regex);

      if (!match) {
        return false;
      }

      event.preventDefault();

      const type = match[1];

      const citeId = match[2];

      const node = view.state.schema.nodes.cite.create({
        cite: citeId,
        citeA: type === "a",
      });

      view.dispatch(view.state.tr.replaceSelectionWith(node));

      return true;
    },
  },
});
