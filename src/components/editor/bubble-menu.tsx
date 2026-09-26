import { BubbleMenu as TiptapBubbleMenu } from "@tiptap/react/menus";
import { useEffect, useState } from "react";
import {
    Bold,
    BookType,
    Italic,
    NotebookTextIcon,
    type LucideIcon,
} from "lucide-react";

import { AliasCreation } from "./bubbles/alias-creation";
import { Button } from "../ui/button";
import { NoteCreation } from "./bubbles/note-creation";

type BubbleButtonProps = {
    icon: LucideIcon;
    onClick: () => void;
    disabled?: boolean;
    active?: boolean;
};

const BubbleButton = ({
    icon: Icon,
    onClick,
    disabled = false,
    active = false,
}: BubbleButtonProps) => {
    return (
        <Button
            type="button"
            size="icon-xs"
            variant={active ? "secondary" : "ghost"}
            disabled={disabled}
            onClick={onClick}
        >
            <Icon />
        </Button>
    );
};

type TabsEntry = Record<
    string,
    {
        show(): boolean;
        component?: React.FC<BubbleMenuProps>;
    }
>;

export const BubbleMenu: React.FC<BubbleProps> = ({
    editor,
}) => {
    const [selection, setSelection] =
        useState<SelectionInfo | null>(null);

    const [tab, setTab] =
        useState<string | null>(null);

    const tabs: TabsEntry = {
        alias: {
            show() {
                return Boolean(
                    selection?.isSingleWord,
                );
            },

            component: AliasCreation,
        },

        note: {
            show() {
                return true;
            },
            component: NoteCreation,
        },

    };

    useEffect(() => {
        const handleSelectionUpdate = () => {
            const { from, to } =
                editor.state.selection;

            if (from === to) {
                setSelection(null);
                setTab(null);
                return;
            }

            const text =
                editor.state.doc.textBetween(
                    from,
                    to,
                    " ",
                );

            const before =
                editor.state.doc.textBetween(
                    Math.max(0, from - 1),
                    from,
                    "",
                );

            const after =
                editor.state.doc.textBetween(
                    to,
                    Math.min(
                        editor.state.doc.content.size,
                        to + 1,
                    ),
                    "",
                );

            const isWordChar = (char: string) =>
                /[\p{L}\p{N}_]/u.test(char);

            const isSingleWord =
                !isWordChar(before) &&
                !isWordChar(after) &&
                /^\S+$/.test(text);

            setSelection({
                text,
                from,
                to,
                isSingleWord,
            });
        };

        editor.on(
            "selectionUpdate",
            handleSelectionUpdate,
        );

        return () => {
            editor.off(
                "selectionUpdate",
                handleSelectionUpdate,
            );
        };
    }, [editor]);

    useEffect(() => {
        if (!tab || !tabs[tab]) {
            return;
        }

        if (!tabs[tab].show()) {
            setTab(null);
        }
    }, [selection, tab]);

    const ActiveComponent =
        tab && tabs[tab]?.show()
            ? tabs[tab].component
            : null;

    return (
        <TiptapBubbleMenu
            editor={editor}
            options={{
                autoPlacement: true,
                
            }}
        >
            {selection && (
                <div className="relative rounded-lg bg-background shadow font-sans">
                    <div className="flex items-center gap-1 p-2">
                        <BubbleButton
                            icon={BookType}
                            active={tab === "alias"}
                            disabled={!tabs.alias.show()}
                            onClick={() =>
                                setTab((current) =>
                                    current === "alias"
                                        ? null
                                        : "alias",
                                )
                            }
                        />

                        <BubbleButton
                            icon={NotebookTextIcon}
                            active={tab === "note"}
                            disabled={!tabs.note.show()}
                            onClick={() =>
                                setTab((current) =>
                                    current === "note"
                                        ? null
                                        : "note",
                                )
                            }
                        />

                        <BubbleButton
                            icon={Bold}
                            active={editor.isActive("bold")}
                            onClick={() =>
                                editor
                                    .chain()
                                    .focus()
                                    .toggleBold()
                                    .run()
                            }
                        />

                        <BubbleButton
                            icon={Italic}
                            active={editor.isActive("italic")}
                            onClick={() =>
                                editor
                                    .chain()
                                    .focus()
                                    .toggleItalic()
                                    .run()
                            }
                        />
                    </div>

                    {ActiveComponent && (
                        <div>
                            <ActiveComponent
                                {...selection}
                                editor={editor}
                            />
                        </div>
                    )}
                </div>
            )}
        </TiptapBubbleMenu>
    );
};