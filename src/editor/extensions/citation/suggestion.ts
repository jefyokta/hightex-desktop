import { useIPC } from "@/hooks/use-ipc";
import type { Editor } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import { ReactRenderer } from "@tiptap/react";
import { shift } from "@floating-ui/dom";
import Suggestion, { exitSuggestion, type SuggestionProps } from "@tiptap/suggestion";
import type { ReferencePickerHandle, ReferencePickerProps } from "@/components/citation/reference-picker";
import { ReferenceSuggestion } from "@/components/citation/reference-suggestion";

/** Both citation styles share search, rendering, keyboard selection and async range checks. */
export function citationSuggestion(editor: Editor, char: "@" | "#") {
  const key = new PluginKey(char === "@" ? "citation-suggestion" : "citation-a-suggestion");
  return Suggestion<never, string>({
    editor,
    pluginKey: key,
    char,
    allowSpaces: true,
    floatingUi: { middleware: [shift({ padding: 12 })] },
    items: () => [],
    command: ({ editor, range, props: referenceKey }) => {
      editor.chain().focus().deleteRange(range).insertContent({
        type: "cite", attrs: { cite: referenceKey, citeA: char === "#" },
      }).run();
    },
    render: () => {
      let renderer: ReactRenderer<ReferencePickerHandle, ReferencePickerProps> | undefined;
      let unmount: (() => void) | undefined;
      let active = false;
      const propsFor = (props: SuggestionProps<never, string>): ReferencePickerProps => ({
        query: props.query,
        zotero: useIPC("config").config.get()?.zotero,
        onDismiss() {
          exitSuggestion(editor.view, key);
          editor.commands.focus();
        },
        onChoose(referenceKey) {
          if (!active || editor.isDestroyed) return;
          const state = key.getState(editor.state);
          // Zotero may finish after the user moves away or changes the trigger text.
          if (!state?.active || state.query !== props.query || state.range.from !== props.range.from) return;
          props.command(referenceKey);
        },
      });
      return {
        onStart(props) {
          active = true;
          renderer = new ReactRenderer(ReferenceSuggestion, {
            editor, props: propsFor(props), className: "z-[9999]",
          });
          renderer.element.dataset.guidePopup = "suggestion";
          unmount = props.mount(renderer.element);
        },
        onUpdate(props) { renderer?.updateProps(propsFor(props)); },
        onKeyDown({ event }) {
          if (event.key === "Escape") return true;
          return renderer?.ref?.onKeyDown(event) ?? false;
        },
        onExit() {
          active = false;
          unmount?.();
          renderer?.destroy();
          renderer = undefined;
        },
      };
    },
  });
}
