import { AliasStorage } from "@/editor/storage/aliases";
import { Editor } from "@tiptap/core";
import { useState } from "react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { Document } from "@/editor/document";

type AliasCreationProps = {
    editor: Editor;
    word: string;
};

export const AliasCreation: React.FC<AliasCreationProps> = ({
    editor,
    word,
}) => {
    const [value, setValue] = useState("");

    const createAlias = async () => {
        const alias = value.trim();

        if (!alias) {
            return;
        }

        await HighTexDB.getInstance().setAlias(
            word,
            alias,
            Document.instance!.id,
        );

        AliasStorage.instance.set(word, alias);
        editor.view.setProps({});
        editor.commands.focus();
    };

    return (
        <div className="flex items-center gap-1.5 px-1.5 py-1">
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                {word}
            </span>

            <span className="text-xs text-muted-foreground">→</span>

            <Input
                value={value}
                onChange={(event) => setValue(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === "Enter") {
                        event.preventDefault();
                        void createAlias();
                    }
                }}
                placeholder="means..."
                className="h-7 w-28 border-0 bg-muted/50 px-2 placeholder:text text-xs shadow-none focus-visible:ring-1"
                autoFocus
            />

            <Button
                type="button"
                onClick={createAlias}
                disabled={!value.trim()}
                className="h-7 px-2 text-xs"
            >
                create
            </Button>
        </div>
    );
};