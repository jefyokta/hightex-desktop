import { HighTexImporter } from "@/utils/import-hightex";
import { t } from "@/utils/lang";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

export const ImportDoc = () => {
    const { filePath = "" } = useParams();
    const [progress, setProgress] = useState(0);

    const handler = async () => {
        setProgress(10);

        const buffer = await window.hightex.readFile(atob(filePath));
        setProgress(30);

        const uint8 = new Uint8Array(buffer);
        const file = new File(
            [uint8],
            filePath.split("/").pop() || "file.hightex",
            {
                type: "application/octet-stream",
            },
        );

        const importer = await HighTexImporter.create(file);
        setProgress(60);

        if (importer.exists) {
            const confirmed = confirm(t("open_file.confirm_overwrite"));

            if (!confirmed) {
                return;
            }
        }

        setProgress(80);

        await importer.import();

        setProgress(100);
    };

    useEffect(() => {
        handler()
            .catch(() => {})
            .finally(() => {
                window.ipcRenderer.send("window:close");
            });
    }, []);

    return (
        <div className="flex h-screen w-screen items-center justify-center">
            <div className="w-80 space-y-3">
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                <p className="text-center text-sm text-muted-foreground">
                    {progress}%
                </p>
            </div>
        </div>
    );
};