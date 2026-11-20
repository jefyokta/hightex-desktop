import { Document } from "@/editor/document";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { useEffect, useState } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Manager } from "@/editor/manager";
import { VariablePresentation } from "./presentation";
import { getEditorChapter } from "@/editor/event";

export function VariableComponent({ node, editor }: NodeViewProps) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    const document = getEditorChapter(editor)?.document ?? Document.instance;
    if (!document) return;
    let alive = true,
      revision = 0;
    const read = async () => {
      const request = ++revision;
      setStatus("loading");
      try {
        const next = await HighTexDB.getInstance().getVar(
          node.attrs.name,
          document.id,
        );
        if (alive && revision === request) {
          setValue(next ?? "");
          setStatus("ready");
        }
      } catch (error) {
        if (alive && revision === request) {
          setStatus("error");
          throw error;
        }
      }
    };
    setValue("");
    void read();
    const offDocument = Manager.app.on("document:updated", (event) => {
      if (event.document.id === document.id) void read();
    });
    const offVariable = Manager.app.on("var:updated", (variable) => {
      if (variable.name === node.attrs.name) void read();
    });
    return () => {
      alive = false;
      offDocument();
      offVariable();
    };
  }, [editor, node.attrs.name]);

  return (
    <NodeViewWrapper as="span" data-variable data-variable-status={status}>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <VariablePresentation value={value} mode={node.attrs.case} />
          </TooltipTrigger>

          <TooltipContent>
            <div className="space-y-1">
              <div className="font-medium italic">@var {node.attrs.name}</div>

              {node.attrs.case !== "preserve" && (
                <div className="text-muted-foreground text-xs ">
                  {node.attrs.case}
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </NodeViewWrapper>
  );
}
