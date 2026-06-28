import {
  DownloadCloudIcon,
  File,
  FileJson,
  FileText,
  Pen,
  Trash,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Dropdown, DropdownItem } from "../dropdown";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { ShouldNotified } from "@/exception/interfaces/should-notified";

interface Props {
  doc: HighTexDocument;
  onRename: (id: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onExport: (id: string, format?: ContentFormat) => Promise<void>;
  onCategoryChange?: (id: string, category: string) => Promise<void>;
}

export const Row = ({
  doc,
  onRename,
  onDelete,
  onExport,

}: Props) => {
  const navigate = useNavigate();

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(doc.title);

  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState<string>(String(doc.category));

  useEffect(() => {
    setValue(doc.title);
    setCategory(String(doc.category));
  }, [doc]);

  useEffect(() => {
    (async () => {
      const data = await window.hightex.categories();
      setCategories(data);

      if (data.length === 0) return;

      const exists = data.some(
        (c) => String(c.id) === String(doc.category),
      );

      if (exists) {
        setCategory(String(doc.category));
      } else {
        setCategory(String(data[0].id));
      }
    })();
  }, [doc.category]);

  const updatedAt = doc.updatedAt
    ? new Date(doc.updatedAt).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    : null;

  return (
    <div className="group flex items-center justify-between rounded-xl border border-transparent px-4 py-3 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900/60">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <File
            size={16}
            className="text-neutral-500 dark:text-neutral-400"
          />
        </div>

        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={async () => {
                await onRename(doc.id, value);
                setEditing(false);
              }}
              onKeyDown={async (e) => {
                if (e.key === "Enter") {
                  await onRename(doc.id, value);
                  setEditing(false);
                }
              }}
              className="w-full bg-transparent text-sm font-medium text-neutral-900 outline-none dark:text-neutral-100"
            />
          ) : (
            <div
              onDoubleClick={() => setEditing(true)}
              className="cursor-text truncate text-sm font-medium text-neutral-900 dark:text-neutral-100"
            >
              {doc.title}
            </div>
          )}

          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
            {categories.length > 0 && (
              <Select
                value={category}
                onValueChange={async (value) => {
                  const previous = category;

                  setCategory(value);

                  try {
                    await HighTexDB.getInstance().updateDocument({ ...doc, category: value })
                    toast.success("Category updated")
                  } catch {
                    setCategory(previous);
                    throw new ShouldNotified("Failed to update category.")
                  }
                }}
                
              >
                <SelectTrigger className="h-6 w-35 border-neutral-200 text-[11px] dark:border-neutral-700">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectGroup>
                    {categories.map((c) => (
                      <SelectItem
                        key={c.id}
                        value={String(c.id)}
                      >
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}

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
            <button className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-neutral-200 dark:hover:bg-neutral-800">
              <DownloadCloudIcon
                size={14}
                className="text-neutral-500 dark:text-neutral-300"
              />
            </button>
          }
        >
          <div className="rounded-lg border border-neutral-200 bg-white p-1 text-xs dark:border-neutral-800 dark:bg-neutral-900">
            <DropdownItem onClick={() => onExport(doc.id)}>
              <div className="flex items-center gap-2 rounded-md px-2 py-1.5 transition hover:bg-neutral-100 dark:hover:bg-neutral-800">
                <FileJson size={14} />
                Export .ht
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

                  toast.success(`Saved ${result.filename}`, {
                    id: toastId,
                  });
                } catch {
                  toast.error("Error while exporting PDF", {
                    id: toastId,
                  });
                } finally {
                  unsubscribe();
                }
              }}
            >
              <div className="flex items-center gap-2 rounded-md px-2 py-1.5 transition hover:bg-neutral-100 dark:hover:bg-neutral-800">
                <FileText size={14} />
                Export .pdf
              </div>
            </DropdownItem>
          </div>
        </Dropdown>

        <button
          className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-neutral-200 dark:hover:bg-neutral-800"
          onClick={() => navigate(`/document/${doc.id}`)}
        >
          <Pen
            size={14}
            className="text-neutral-500 dark:text-neutral-300"
          />
        </button>

        <button
          onClick={() => onDelete(doc.id)}
          className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-red-50 dark:hover:bg-red-900/20"
        >
          <Trash
            size={14}
            className="text-neutral-400 hover:text-red-500"
          />
        </button>
      </div>
    </div>
  );
};