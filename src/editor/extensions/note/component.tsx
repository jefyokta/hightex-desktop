import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { getRandomColor } from "@/utils/sharing";
import type { MarkViewRendererProps } from "@tiptap/core";
import { MarkViewContent } from "@tiptap/react";
import {
    Clock3,
    MessageSquareText,
    Trash2,
} from "lucide-react";
import { useState } from "react";

export const NoteComponent = ({
    mark,
    editor,
}: MarkViewRendererProps) => {
    const [open, setOpen] = useState(false);

    const {
        id,
        note,
        created,
    } = mark.attrs;

    const createdDate = created
        ? new Date(created)
        : null;

    const createdText =
        createdDate &&
        !Number.isNaN(createdDate.getTime())
            ? new Intl.DateTimeFormat(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
              }).format(createdDate)
            : null;

    const handleUnset = () => {
        setOpen(false);

        requestAnimationFrame(() => {
            const { state, view } = editor;
            const ranges: Array<{
                from: number;
                to: number;
            }> = [];

            state.doc.nodesBetween(
                0,
                state.doc.content.size,
                (node, pos) => {
                    if (!node.isInline) {
                        return true;
                    }

                    const hasNote = node.marks.some(
                        (nodeMark) =>
                            nodeMark.type === mark.type &&
                            nodeMark.attrs.id === id,
                    );

                    if (!hasNote) {
                        return true;
                    }

                    ranges.push({
                        from: pos,
                        to: pos + node.nodeSize,
                    });

                    return true;
                },
            );

            if (!ranges.length) {
                return;
            }

            let transaction = state.tr;

            for (const range of ranges) {
                transaction = transaction.removeMark(
                    range.from,
                    range.to,
                    mark.type,
                );
            }

            view.dispatch(transaction);
        });
    };

    return (
        <span
            style={{
                backgroundColor: getRandomColor(id),
            }}
            className="mix-blend-multiply"
        >
            <Popover
                open={open}
                onOpenChange={setOpen}
            >
                <PopoverTrigger asChild>
                    <span className="cursor-pointer">
                        <MarkViewContent />
                    </span>
                </PopoverTrigger>

                <PopoverContent
                    side="top"
                    align="start"
                    sideOffset={8}
                    className="w-80 p-0"
                >
                    <div className="flex items-center gap-2 border-b px-3 py-2">
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
                            <MessageSquareText className="size-4" />
                        </div>

                        <div className="min-w-0">
                            <p className="text-sm font-medium">
                                Note
                            </p>

                            {createdText && (
                                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                    <Clock3 className="size-3" />
                                    <span>
                                        {createdText}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="px-3 py-3">
                        <p className="whitespace-pre-wrap wrap-break-word text-sm leading-relaxed">
                            {note || (
                                <span className="italic text-muted-foreground">
                                    No note
                                </span>
                            )}
                        </p>
                    </div>

                    <div className="border-t p-1">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={handleUnset}
                        >
                            <Trash2 className="size-4" />
                            Remove note
                        </Button>
                    </div>
                </PopoverContent>
            </Popover>
        </span>
    );
}