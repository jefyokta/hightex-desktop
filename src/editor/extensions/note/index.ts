import { Mark } from "@tiptap/core";
import { UUIDAttributes } from "../uuid";
import { ReactMarkViewRenderer } from "@tiptap/react";
import { NoteComponent } from "./component";
import { notePresentation } from "./presentation";

export const Note = Mark.create({
  name: "note",
  renderHTML({ HTMLAttributes }) {
    const presentation = notePresentation(HTMLAttributes.id);
    return [
      "abbr",
      {
        ...HTMLAttributes,
        title: HTMLAttributes["data-note"] ?? "",
        style: `background-color:${presentation.backgroundColor};mix-blend-mode:${presentation.mixBlendMode}`,
      },
      0,
    ];
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      note: {
        default: "",
        parseHTML(element) {
          return element.getAttribute("data-note");
        },
        renderHTML(attributes) {
          return {
            "data-note": attributes.note,
          };
        },
      },
      created: {
        default: new Date().toISOString(),
        parseHTML(element) {
          return new Date(
            element.getAttribute("data-created") || new Date(),
          ).toISOString();
        },
        renderHTML(attributes) {
          return {
            "data-created": attributes.created,
          };
        },
      },
      ...UUIDAttributes(),
    };
  },
  addMarkView() {
    return ReactMarkViewRenderer(NoteComponent);
  },
});
