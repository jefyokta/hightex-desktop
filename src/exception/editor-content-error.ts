import { Editor } from "@tiptap/core";
import { ApplicationError } from "./application-error";

export class EditorContentError extends ApplicationError {
  readonly editor: Editor;
  readonly prevError?: Error;
  name: string = EditorContentError.name;
  constructor({
    message,
    editor,
    prevError,
  }: {
    message?: string;
    editor: Editor;
    prevError?: Error;
  }) {
    super(message ?? "Content Error");
    this.editor = editor;
    this.prevError = prevError;
  }
}
