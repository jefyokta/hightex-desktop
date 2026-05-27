import { Editor } from "@tiptap/core";
import { ShouldNotified } from "./interfaces/should-notified";
import { Button } from "@/components/ui/button";
import { ContentFixer } from "@/utils/content-fixer";
import { toast } from "sonner";

export class EditorContentError extends ShouldNotified<"error"> {
  readonly editor: Editor;
  readonly prevError?: Error;
  readonly level = "error";
  name: string = EditorContentError.name;

  constructor(editor: Editor) {
    super({
      message: "Content error",
      description: "Your document scheme contains invalid content",
      action: (
        <Button
          onClick={async () => {
            toast.dismiss(this.id);

            await toast.promise(
              new Promise((resolve) => {
                setTimeout(() => {
                  ContentFixer(editor.getJSON(), editor.schema);
                  resolve(1);
                }, 1000);
              }),
              {
                loading: "Fixing document...",
                success: "Document fixed",
                error: "Failed to fix document",
              },
            );
          }}
        >
          Fix
        </Button>
      ),
    });
    this.editor = editor;
  }
}
