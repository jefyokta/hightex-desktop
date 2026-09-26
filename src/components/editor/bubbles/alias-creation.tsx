import { AliasStorage } from "@/editor/storage/aliases";
import { useState } from "react";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { Document } from "@/editor/document";


export const AliasCreation: React.FC<BubbleMenuProps> = ({
    editor,
    isSingleWord,
    text,
}) => {
    const [value, setValue] = useState("");

    const createAlias = async () => {
        const alias = value.trim();
        if (!isSingleWord) return

        if (!alias) {
            return;
        }

        await HighTexDB.getInstance().setAlias(
            text,
            alias,
            Document.instance!.id,
        );

        AliasStorage.instance.set(text, alias);
        editor.view.setProps({});
        editor.commands.focus();
    };

    return (
        <div className="flex items-center gap-1.5 px-1.5 py-1">
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                {text.trim()}
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