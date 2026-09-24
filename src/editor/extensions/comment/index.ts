import { CommentStorage } from "@/editor/storage/comment";
import { getRandomColor } from "@/utils/sharing";
import { Decoration, Editor, Extension } from "@tiptap/core";


const getNodePositionInEditor = (
    editor: Editor,
    selection: SelectionAnchor,
): number | null => {
    let position: number | null = null;

    editor.state.doc.descendants((node, pos) => {
        if (node.attrs.id !== selection.uuid) {
            return true;
        }

        position = pos + selection.offset;

        return false;
    });

    return position;
};

export const Comment = Extension.create({
    name: "comment",
    addDecorations() {
        const decorations: Decoration[] = [];

        return {
            create({ editor }) {
                CommentStorage.instance.all().map((c) => {
                    const start = getNodePositionInEditor(
                        editor,
                        c.data.start,
                    );

                    const end = getNodePositionInEditor(
                        editor,
                        c.data.end,
                    );
                    console.log(start,end)
                    if (start === null || end === null) {
                        return;
                    }

                    decorations.push(
                        Decoration.Inline(start, end, {
                            class: `editor-comment `,
                            "data-comment-id":c.id,
                            style: `background-color: ${getRandomColor(c.id)};`,

                        }),
                    );
                });

                return decorations;
            },
        };
    },
});