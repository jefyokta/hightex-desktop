import { Editor } from "@tiptap/react";
import { useState, useEffect } from "react";
import {
  useFloating,
  offset,
  flip,
  shift,
  autoUpdate,
  size,
} from "@floating-ui/react";

import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Merge,
  Split,
  Grid2X2,
  Grid2x2X,
  Plus,
} from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const sizeToHeightMiddleware = size({
  apply({ rects, elements }) {
    Object.assign(elements.floating.style, {
      height: `${rects.reference.height}px`,
    });
  },
});

const sizeToWidthMiddleware = size({
  apply({ rects, elements }) {
    Object.assign(elements.floating.style, {
      width: `${rects.reference.width}px`,
    });
  },
});

const ToolButton = ({ icon, tooltip, onClick, destructive = false }: any) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        onClick={onClick}
        className={`
                    w-7 h-7
                    flex items-center justify-center
                    rounded-md
                    transition
                    shrink-0
                    ${
                      destructive
                        ? "hover:bg-destructive/10 text-destructive"
                        : "hover:bg-muted"
                    }
                `}
      >
        {icon}
      </button>
    </TooltipTrigger>

    <TooltipContent side="top" className="text-[11px] px-2 py-1">
      {tooltip}
    </TooltipContent>
  </Tooltip>
);

const Divider = () => <div className="w-px h-4 bg-border mx-1 shrink-0" />;

const CellMenu = ({ editor }: { editor: Editor }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [referenceElement, setReferenceElement] = useState<HTMLElement | null>(
    null,
  );
  const [open, setOpen] = useState(false);

  const { refs, floatingStyles } = useFloating({
    placement: "top",
    strategy: "fixed",
    middleware: [offset(6), flip(), shift()],
    whileElementsMounted: autoUpdate,
  });

  useEffect(() => {
    const listener = () => {
      const { anchor } = editor.state.selection;
      const { node } = editor.view.domAtPos(anchor);

      const td = (node as HTMLElement)?.closest?.("td,th");

      if (td) {
        setReferenceElement(td as HTMLElement);
        setIsVisible(true);
      } else {
        setReferenceElement(null);
        setIsVisible(false);
      }
    };

    editor.on("selectionUpdate", listener);
    editor.on("transaction", listener);

    return () => {
      editor.off("selectionUpdate", listener);
      editor.off("transaction", listener);
    };
  }, [editor]);

  useEffect(() => {
    refs.setReference(referenceElement);
  }, [referenceElement]);

  if (!isVisible) return null;

  return (
    <div
      ref={refs.setFloating}
      style={{
        ...floatingStyles,
        fontFamily: `"Geist Variable", sans-serif`,
      }}
      className="z-50 fixed flex items-center"
    >
      <div
        className="
                    flex items-center
                    rounded-lg border
                    bg-background/95
                    backdrop-blur
                    shadow-md
                    overflow-hidden
                "
      >
        {/* trigger */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setOpen(!open)}
              className="
                                w-7 h-7
                                flex items-center justify-center
                                hover:bg-muted
                                transition
                                shrink-0
                            "
            >
              <Grid2X2 className="w-3.5 h-3.5 opacity-80" />
            </button>
          </TooltipTrigger>

          <TooltipContent className="text-[11px] px-2 py-1">
            Table tools
          </TooltipContent>
        </Tooltip>

        <div
          className="
                        flex items-center
                        overflow-hidden
                        transition-[max-width,opacity]
                        duration-200
                        ease-out
                    "
          style={{
            maxWidth: open ? 220 : 0,
            opacity: open ? 1 : 0,
          }}
        >
          <div className="flex items-center gap-0.5 px-1">
            <ToolButton
              tooltip="Align left"
              onClick={() => {
                editor.commands.setCellAlignmentLeft();
              }}
              icon={<AlignLeft className="w-3.5 h-3.5" />}
            />

            <ToolButton
              tooltip="Align center"
              onClick={() => {
                editor.commands.setCellAlignmentCenter();
              }}
              icon={<AlignCenter className="w-3.5 h-3.5" />}
            />

            <ToolButton
              tooltip="Align right"
              onClick={() => {
                editor.commands.setCellAlignmentRight();
              }}
              icon={<AlignRight className="w-3.5 h-3.5" />}
            />

            <Divider />

            <ToolButton
              tooltip="Merge cells"
              onClick={() => {
                editor.commands.mergeCells();
              }}
              icon={<Merge className="w-3.5 h-3.5" />}
            />

            <ToolButton
              tooltip="Split cell"
              onClick={() => {
                editor.commands.splitCell();
              }}
              icon={<Split className="w-3.5 h-3.5" />}
            />

            <Divider />

            <ToolButton
              destructive
              tooltip="Delete column"
              onClick={() => {
                editor.commands.deleteColumn();
              }}
              icon={<Grid2x2X className="w-3.5 h-3.5" />}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const RowMenu = ({ editor }: { editor: Editor }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [referenceElement, setReferenceElement] = useState<HTMLElement | null>(
    null,
  );

  const { refs, floatingStyles } = useFloating({
    placement: "left",
    strategy: "fixed",
    middleware: [offset(6), flip(), shift()],
    whileElementsMounted: autoUpdate,
  });

  useEffect(() => {
    const listener = () => {
      const { anchor } = editor.state.selection;
      const { node } = editor.view.domAtPos(anchor);

      const tr = (node as HTMLElement)?.closest?.("tr");

      if (tr) {
        setReferenceElement(tr as HTMLElement);
        setIsVisible(true);
      } else {
        setReferenceElement(null);
        setIsVisible(false);
      }
    };

    editor.on("selectionUpdate", listener);
    editor.on("transaction", listener);

    return () => {
      editor.off("selectionUpdate", listener);
      editor.off("transaction", listener);
    };
  }, [editor]);

  useEffect(() => {
    refs.setReference(referenceElement);
  }, [referenceElement]);

  if (!isVisible) return null;

  return (
    <div
      ref={refs.setFloating}
      style={floatingStyles}
      className="z-50 fixed flex items-center"
    >
      <div
        className="
                    flex items-center
                    rounded-lg border
                    bg-background/95
                    backdrop-blur
                    shadow-md
                    overflow-hidden
                "
      >
        <ToolButton
          destructive
          tooltip="Delete row"
          onClick={() => {
            editor.commands.deleteRow();
          }}
          icon={<Grid2x2X className="w-3.5 h-3.5" />}
        />
      </div>
    </div>
  );
};

const AddRowColumnAfter = ({ editor }: { editor: Editor }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [referenceElement, setReferenceElement] = useState<HTMLElement | null>(
    null,
  );

  const floatingRight = useFloating({
    placement: "right",
    strategy: "absolute",
    middleware: [offset(5), sizeToHeightMiddleware],
    whileElementsMounted: autoUpdate,
  });

  const floatingBottom = useFloating({
    placement: "bottom",
    strategy: "absolute",
    middleware: [offset(5), shift(), sizeToWidthMiddleware],
    whileElementsMounted: autoUpdate,
  });

  useEffect(() => {
    const listener = () => {
      const { anchor } = editor.state.selection;
      const { node } = editor.view.domAtPos(anchor);

      const table = (node as HTMLElement)?.closest?.("table");

      if (table) {
        setReferenceElement(table as HTMLElement);
        setIsVisible(true);
      } else {
        setReferenceElement(null);
        setIsVisible(false);
      }
    };

    editor.on("selectionUpdate", listener);
    editor.on("transaction", listener);

    listener();

    return () => {
      editor.off("selectionUpdate", listener);
      editor.off("transaction", listener);
    };
  }, [editor]);

  useEffect(() => {
    floatingRight.refs.setReference(referenceElement);
    floatingBottom.refs.setReference(referenceElement);
  }, [referenceElement]);

  if (!isVisible) return null;

  return (
    <>
      {/* add column */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            ref={floatingRight.refs.setFloating}
            style={floatingRight.floatingStyles}
            onClick={() => editor.chain().addColumnAfter().run()}
            className="
                            z-50 fixed
                            rounded-md
                            bg-muted
                            hover:bg-muted/80
                            transition
                            flex items-center justify-center
                            cursor-pointer
                            shadow-sm
                        "
          >
            <Plus size={14} />
          </div>
        </TooltipTrigger>

        <TooltipContent className="text-[11px] px-2 py-1">
          Add column
        </TooltipContent>
      </Tooltip>

      {/* add row */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            ref={floatingBottom.refs.setFloating}
            style={floatingBottom.floatingStyles}
            onClick={() => editor.chain().addRowAfter().run()}
            className="
                            z-50 fixed
                            rounded-md
                            bg-muted
                            hover:bg-muted/80
                            transition
                            flex items-center justify-center
                            cursor-pointer
                            shadow-sm
                        "
          >
            <Plus size={14} />
          </div>
        </TooltipTrigger>

        <TooltipContent className="text-[11px] px-2 py-1">
          Add row
        </TooltipContent>
      </Tooltip>
    </>
  );
};

export const TableMenu = ({ editor }: { editor: Editor }) => {
  return (
    <TooltipProvider delayDuration={150}>
      <CellMenu editor={editor} />
      <RowMenu editor={editor} />
      <AddRowColumnAfter editor={editor} />
    </TooltipProvider>
  );
};
