import { useAppLanguage } from "@/hooks/use-app-language";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { useEffect, useState } from "react";
import { Copy, Trash2 } from "lucide-react";

import TextareaAutosize from "react-textarea-autosize";
import { toast } from "sonner";
import { Manager } from "@/editor/manager";
import { Document } from "@/editor/document";
import { getEditorChapter } from "@/editor/event";
import { t } from "@/utils/lang";
import { mathPresentation, MathBlockPresentation } from "./presentation";
import { paginationReport } from "@/editor/pagination/report-error";

export const MathBlockComponent = ({
  node,
  updateAttributes,
  deleteNode,
  editor,
}: NodeViewProps) => {
  useAppLanguage();
  const latex = String(node.attrs.latex ?? "");
  const [open, setOpen] = useState(false);

  const [number, setNumber] = useState<number | null>(null);

  const content = mathPresentation(latex, true);

  useEffect(() => {
    if (!open) return;

    const frame = requestAnimationFrame(() => {
      if (!editor.isDestroyed) editor.view.dom.blur();
    });
    return () => cancelAnimationFrame(frame);
  }, [editor, open]);

  useEffect(() => {
    const equationId: string | null = node.attrs.id;
    const document = getEditorChapter(editor)?.document ?? Document.instance;
    let active = true;
    let revision = 0;
    setNumber(null);

    const updateNumber = async () => {
      if (!equationId || !document) return;
      const request = ++revision;
      try {
        const equations = await document.getEquations();
        if (!active || request !== revision) return;
        const graph = equations.find((equation) => equation.id === equationId);
        setNumber(graph?.pos ?? null);
      } catch (error) {
        if (active && request === revision) {
          const report = paginationReport(error, "Memuat nomor persamaan");
          if (report) throw report;
        }
      }
    };

    const offChapter = Manager.app.on("chapter:update", ({ chapter }) => {
      if (chapter.document === document) void updateNumber();
    });
    void updateNumber();
    return () => {
      active = false;
      offChapter();
    };
  }, [editor, node.attrs.id]);
  return (
    <NodeViewWrapper
      className="my-4"
      contentEditable={false}
      id={node.attrs.id}
      data-latex={latex}
    >
      <Popover open={open} onOpenChange={setOpen} modal>
        <PopoverTrigger
          onClick={(e) => {
            e.preventDefault();
            setOpen(true);
          }}
          asChild
        >
          <MathBlockPresentation
            html={content.html}
            number={number}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setOpen(true);
              }
            }}
          />
        </PopoverTrigger>

        <PopoverContent className="w-90 p-4 space-y-4">
          <TextareaAutosize
            value={latex}
            onKeyDownCapture={(e) => {
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
            }}
            minRows={3}
            maxRows={10}
            onMouseDownCapture={(e) => {
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
            }}
            className="w-full ring-0 rounded-md bg-neutral-100 dark:bg-black outline-0! min-h-37.5 font-mono text-xs"
            onChange={(e) => {
              e.preventDefault();
              updateAttributes({ latex: e.target.value });
            }}
          />

          <div className="flex gap-2 pt-2 border-t">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                navigator.clipboard
                  .writeText(node.attrs.id)
                  .then(() => toast.success(t("editor.inline.equation_copied")))
              }
            >
              <Copy className="w-4 h-4 mr-1" />
              {t("editor.inline.quote")}
            </Button>

            <Button size="sm" variant="destructive" onClick={deleteNode}>
              <Trash2 className="w-4 h-4 mr-1" />
              {t("editor.inline.delete")}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </NodeViewWrapper>
  );
};
