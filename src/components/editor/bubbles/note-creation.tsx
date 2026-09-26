import { useState } from "react";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";



export const NoteCreation: React.FC<BubbleMenuProps> = ({
    editor
}) => {
    const [value, setValue] = useState("");

    const createNote = () => {
        editor.chain().focus().toggleMark("note", {
            note: value,

        }).run()
        console.log("created")

    }
    return (
        <div className="flex items-center gap-1.5 px-1.5 py-1">

            <Input
                value={value}
                onChange={(event) => setValue(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === "Enter") {
                        event.preventDefault();
                        void createNote()
                    }
                }}
                placeholder="say something..."
                className="h-7 w-28 border-0 bg-muted/50 px-2 placeholder:text text-xs shadow-none focus-visible:ring-1"
                autoFocus
            />

            <Button
                type="button"
                onClick={createNote}
                disabled={!value.trim()}
                className="h-7 px-2 text-xs"
            >
                create
            </Button>
        </div>
    );
};