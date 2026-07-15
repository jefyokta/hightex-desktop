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

function applyCase(value: string, mode: string) {
  switch (mode) {
    case "upper":
      return value.toUpperCase();

    case "lower":
      return value.toLowerCase();

    case "capitalize":
      return value
        ? value[0].toUpperCase() + value.substring(1).toLowerCase()
        : value;

    case "title":
      return value.replace(
        /\w\S*/g,
        (word) => word[0].toUpperCase() + word.substring(1).toLowerCase(),
      );

    default:
      return value;
  }
}

export function VariableComponent({ node }: NodeViewProps) {
  const [value, setValue] = useState("");

  useEffect(() => {
    if (!Document.instance) return;

    HighTexDB.getInstance()
      .getVar(node.attrs.name, Document.instance.id)
      .then((v) => setValue(v ?? ""));
  }, [node.attrs.name]);

  useEffect(() => {
    return Manager.app.on("var:updated", (vr) => {
      if (vr.name == node.attrs.name) {
        setValue(vr.value);
      }
    });
  }, []);

  return (
    <NodeViewWrapper as="span" data-variable>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>{applyCase(value, node.attrs.case)}</span>
          </TooltipTrigger>

          <TooltipContent>
            <div className="space-y-1">
              <div className="font-medium italic">@var {node.attrs.name}</div>

              {node.attrs.case !== "preserve" && (
                <div className="text-muted-foreground text-xs">
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
