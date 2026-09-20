import { Editor } from "@tiptap/core";
import { ShouldNotified } from "./interfaces/should-notified";
import { Button } from "@/components/ui/button";
import { ContentFixer } from "@/utils/content-fixer";
import { toast } from "sonner";
import { t } from "@/utils/lang";

export class EditorContentError extends ShouldNotified<"error"> {
  readonly editor: Editor;
  readonly prevError?: Error;
  readonly level = "error";
  name: string = EditorContentError.name;

  constructor(editor: Editor) {
    super({
      message: t("editor.error.content_error.title"),
      description: t("editor.error.content_error.description"),
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
                loading: t("editor.error.content_error.fixing"),
                success: t("editor.error.content_error.fixed"),
                error: t("editor.error.content_error.fix_failed"),
              },
            );
          }}
        >
          {t("editor.error.content_error.fix_button")}
        </Button>
      ),
    });
    this.editor = editor;
  }
}
