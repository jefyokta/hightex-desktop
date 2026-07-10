import { Document } from "@/editor/document";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export const EditorNavigatorSlave = () => {
    const go = useNavigate();

    const navigate = (chapter: number) => {
        const doc = Document.instance;
        if (!doc) return;

        const validChapter = doc.category?.chapters?.find(
            (c) => Number(c.chapter) === chapter
        );

        if (!validChapter) return;

        go(`/document/${doc.id}/${chapter}`);
    };

    useEffect(() => {
        const listener = (e: KeyboardEvent) => {
            if (!(e.metaKey || e.ctrlKey)) return;

            const chapter = Number(e.key);

            if (Number.isNaN(chapter) || chapter < 1 || chapter > 9) {
                return;
            }

            e.preventDefault();
            navigate(chapter);
        };

        document.addEventListener("keydown", listener);

        return () => document.removeEventListener("keydown", listener);
    }, []);

    return null;
};