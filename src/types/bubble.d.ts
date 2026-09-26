import { Editor } from "@tiptap/core";

export {}
declare global {
   type BubbleMenuProps =SelectionInfo &BubbleProps
   type SelectionInfo = {
    text: string;
    from: number;
    to: number;
    isSingleWord: boolean;

};
type BubbleProps = {
    editor: Editor;
};
}