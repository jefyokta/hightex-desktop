import { CommentStorage } from "@/editor/storage/comment";
import { useCurrentEditor } from "@/hooks/use-editor";
import {
    autoUpdate,
    flip,
    offset,
    shift,
    useDismiss,
    useFloating,
    useInteractions,
} from "@floating-ui/react";
import { useEffect, useState } from "react";

export const CommentSlave = () => {
    const { editor } = useCurrentEditor();

    const [target, setTarget] = useState<HTMLElement | null>(null);
    const [comment, setComment] = useState<CommentEntity | null>(null);
    const [open, setOpen] = useState(false);

    const {
        refs,
        context,
        floatingStyles,
    } = useFloating({
        open,
        onOpenChange: setOpen,
        strategy: "fixed",
        placement: "bottom-start",
        middleware: [
            offset(8),
            flip(),
            shift({ padding: 8 }),
        ],
        whileElementsMounted: autoUpdate,
    });

    const dismiss = useDismiss(context);

    const { getFloatingProps } = useInteractions([
        dismiss,
    ]);

    useEffect(() => {
        if (!editor) return;
        if(!editor.isInitialized) return;

    

        const root = editor.view.dom;

        const onClick = (event: MouseEvent) => {
            const target = event.target;

            if (!(target instanceof Element)) {
                return;
            }

            const element = target.closest<HTMLElement>(
                "[data-comment-id]",
            );

            if (!element || !root.contains(element)) {
                return;
            }

            const commentId = element.dataset.commentId;

            if (!commentId) {
                return;
            }

            const nextComment =
                CommentStorage.instance
                    .all()
                    .find((comment) => comment.id === commentId);

            if (!nextComment) {
                return;
            }

            setTarget(element);
            setComment(nextComment);
            setOpen(true);
        };

        root.addEventListener("click", onClick);

        return () => {
            root.removeEventListener("click", onClick);
        };
    }, [editor]);

    useEffect(() => {
        refs.setPositionReference(target);
    }, [target, refs]);

    useEffect(() => {
        if (!editor) return;

        return () => {
            setTarget(null);
            setComment(null);
            setOpen(false);
        };
    }, [editor]);

    if (!open || !target || !comment) {
        return null;
    }

    return (
        <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className="z-50 w-72 overflow-hidden rounded-xl border bg-popover font-sans text-popover-foreground shadow-lg"
        >
            <div className="border-b bg-muted/30 px-3 py-2.5">
                <div className="flex items-center gap-2">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                        {comment.role.charAt(0).toUpperCase()}
                    </div>

                    <div className="min-w-0">
                        <div className="truncate text-xs font-medium capitalize">
                            {comment.role}
                        </div>

                        <div className="text-[11px] text-muted-foreground">
                            Comment
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-3 py-3">
                <p className="text-sm leading-relaxed">
                    {comment.text}
                </p>
            </div>
        </div>
    );
};