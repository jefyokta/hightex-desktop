import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { uniqId } from "@/utils/uniq-id";
import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import katex from "katex";
import { useEffect, useRef, useState } from "react";
import { Copy, Trash2 } from "lucide-react";

import TextareaAutosize from "react-textarea-autosize";
import { toast } from "sonner";
import { Manager } from "@/editor/manager";
import { Document } from "@/editor/document";
import { getEditorChapter } from "@/editor/event";
import { t, useAppLanguage } from "@/utils/lang";

export const MathBlockComponent = ({
  node,
  updateAttributes,
  deleteNode,
  editor,
}: NodeViewProps) => {
  useAppLanguage();
  const containerRef = useRef<HTMLDivElement>(null);

  const [latex, setLatex] = useState(node.attrs.latex ?? "");
  const [open, setOpen] = useState(false);

  const [number, setNumber] = useState<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    katex.render(latex || "\\;", containerRef.current, {
      throwOnError: false,
      displayMode: true,
    });
  }, [latex]);

  useEffect(() => {
    if (!open) return;

    requestAnimationFrame(() => {
      editor.view.dom.blur();
    });
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
        if (active && request === revision)
          console.error("Unable to load equation number", error);
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
  const update = () => {
    return setTimeout(() => {
      if (latex !== node.attrs.latex) {
        updateAttributes({ latex });
      }
    }, 50);
  };

  useEffect(() => {
    if (!node.attrs.id) {
      updateAttributes({ id: "eq-" + uniqId() });
    }
  }, [node.attrs.id, updateAttributes]);

  return (
    <NodeViewWrapper className="my-4" contentEditable={false} {...node.attrs}>
      <div className="flex justify-center" id={node.attrs.id}>
        <Popover open={open} onOpenChange={setOpen} modal>
          <PopoverTrigger
            onClick={(e) => {
              e.preventDefault();
              setOpen(true);
            }}
            asChild
          >
            <button type="button" className="hover:bg-black/10 rounded-md p-2">
              <div className="flex items-center gap-3">
                <div
                  ref={containerRef}
                  className="pointer-events-none select-none"
                />
                {number !== null && (
                  <span className="text-sm text-neutral-500">({number})</span>
                )}
              </div>
            </button>
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
                setLatex(e.target.value);
              }}
              onKeyUp={() => update()}
            />

            <div className="flex gap-2 pt-2 border-t">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  navigator.clipboard
                    .writeText(node.attrs.id)
                    .then(() =>
                      toast.success(t("editor.inline.equation_copied")),
                    )
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
      </div>
    </NodeViewWrapper>
  );
};
