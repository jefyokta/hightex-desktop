import { Editor } from "@tiptap/core";
import { BubbleMenu as TiptapBubbleMenu } from "@tiptap/react/menus";
import { useEffect, useState } from "react";
import { AliasCreation } from "./alias-creation";

type BubbleMenuProps = {
    editor: Editor;
};

export const BubbleMenu: React.FC<BubbleMenuProps> = ({ editor }) => {
    const [selectedText, setSelectedText] = useState<string | null>(null);

    useEffect(() => {
        const handleSelectionUpdate = () => {
            const { from, to } = editor.state.selection;

            if (from === to) {
                setSelectedText(null);
                return;
            }

            const text = editor.state.doc.textBetween(from, to, " ");

            const before = editor.state.doc.textBetween(from - 1, from, "");
            const after = editor.state.doc.textBetween(to, to + 1, "");

            const isWordChar = (char: string) =>
                /[\p{L}\p{N}_]/u.test(char);

            const isSingleWord =
                !isWordChar(before) &&
                !isWordChar(after) &&
                /^\S+$/.test(text);

            setSelectedText(isSingleWord ? text : null);
        };

        editor.on("selectionUpdate", handleSelectionUpdate);

        return () => {
            editor.off("selectionUpdate", handleSelectionUpdate);
        };
    }, [editor]);

    return (
        <TiptapBubbleMenu editor={editor}>
            {selectedText && (
                <div className="rounded-lg bg-background shadow font-sans">
                    <AliasCreation
                        editor={editor}
                        word={selectedText}
                    />
                </div>
            )}
        </TiptapBubbleMenu>
    );
};