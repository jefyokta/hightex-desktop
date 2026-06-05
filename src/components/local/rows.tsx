import { DownloadCloudIcon, Eye, File, FileJson, FileText, FileType, Trash } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dropdown, DropdownItem } from "../dropdown";
import { toast } from "sonner";

interface Props {
    doc: HighTexDocument,
    onRename: (id: string, title: string) => Promise<void>,
    onDelete: (id: string) => Promise<void>,
    onExport: (id: string, format?: ContentFormat) => Promise<void>,

}
export const Row = ({ doc, onRename, onDelete, onExport }: Props) => {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(doc.title);

    const [category, setCategory] = useState("-");
    const navigate = useNavigate();


    useEffect(() => {
        (async () => {
            const categories = await window.hightex.categories();

            const cat = categories.find((c) => doc.category == String(c.id));

            if (cat) setCategory(cat.name);
        })();
    }, []);

    const updatedAt = doc.updatedAt
        ? new Date(doc.updatedAt).toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        })
        : null;

    return (
        <div className="group flex items-center space-x-10 justify-between rounded-xl border border-transparent px-4 py-3 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900/60">
            <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
                    <File size={16} className="text-neutral-500 dark:text-neutral-400" />
                </div>

                <div className="min-w-0 flex-1">
                    {editing ? (
                        <input
                            autoFocus
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            onBlur={() => {
                                onRename(doc.id, value);
                                setEditing(false);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    onRename(doc.id, value);
                                    setEditing(false);
                                }
                            }}
                            className="w-full bg-transparent text-sm font-medium outline-none text-neutral-900 dark:text-neutral-100"
                        />
                    ) : (
                        <div
                            onDoubleClick={() => setEditing(true)}
                            className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100 cursor-text"
                        >
                            {doc.title}
                        </div>
                    )}

                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="rounded-md border border-neutral-200 dark:border-neutral-800 px-1.5 py-0.5 text-neutral-500 dark:text-neutral-400">
                            {category || "-"}
                        </span>

                        {updatedAt && (
                            <>
                                <span className="text-neutral-300 dark:text-neutral-600">
                                    •
                                </span>

                                <span className="text-neutral-400 dark:text-neutral-500">
                                    Updated {updatedAt}
                                </span>
                            </>
                        )}

                        <span className="text-neutral-300 dark:text-neutral-600">•</span>

                        <span className="tabular-nums text-neutral-400 dark:text-neutral-500">
                            {doc.id.slice(0, 6)}
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">


                <Dropdown
                    align="right"
                    width="max-content"
                    trigger={
                        <button className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition">
                            <DownloadCloudIcon
                                size={14}
                                className="text-neutral-500 dark:text-neutral-300"
                            />
                        </button>
                    }
                >
                    <div className="p-1 text-xs bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800">
                        <DropdownItem onClick={() => onExport?.(doc.id)}>
                            <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition text-neutral-700 dark:text-neutral-200">
                                <FileJson size={14} />  Export .ht (json)
                            </div>
                        </DropdownItem>
                        <DropdownItem onClick={() => onExport?.(doc.id, 'ht')}>
                            <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition text-neutral-700 dark:text-neutral-200">
                                <FileType size={14} /> Export .htx (ht)
                            </div>
                        </DropdownItem>
                        <DropdownItem
                            onClick={async () => {
                                const toastId = toast.loading("Preparing PDF export...");
                                const unsubscribe = window.hightex.onPdfProgress((update) => {
                                    toast(update.status, { id: toastId });
                                });

                                try {
                                    const result = await window.ipcRenderer.invoke(
                                        "hightex:pdf",
                                        doc.id,
                                    );

                                    if (!result) {
                                        toast.dismiss(toastId);
                                        return;
                                    }

                                    toast.success(`Saved ${result.filename}`, { id: toastId });
                                } catch (error) {
                                    toast.error("Error while exporting PDF", { id: toastId });
                                } finally {
                                    unsubscribe();
                                }
                            }}
                        >
                            <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition text-neutral-700 dark:text-neutral-200">
                               <FileText size={14}/>   Export .pdf
                            </div>
                        </DropdownItem>
                    </div>
                </Dropdown>

                <button
                    className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition"
                    onClick={() => navigate(`/document/${doc.id}`)}
                >
                    <Eye size={14} className="text-neutral-500 dark:text-neutral-300" />
                </button>

                <button
                    onClick={() => onDelete(doc.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                >
                    <Trash size={14} className="text-neutral-400 hover:text-red-500" />
                </button>
            </div>
        </div>
    );
};