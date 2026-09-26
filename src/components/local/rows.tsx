import {
  CircleCheck,
  CircleMinus,
  DownloadCloudIcon,
  File,
  FileJson,
  FileText,
  Pen,
  Trash,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import { cn } from "@/lib/utils";
import { ParsedItalic } from "@/utils/parse-italic";
import { Button } from "../ui/button";
import { truncate } from "@/utils/truncate";
import { ApplicationError } from "@/exception/interfaces/application-error";
import { t } from "@/utils/lang";
import { Textarea } from "../ui/textarea";
import { useMultiSelect } from "@/hooks/use-multi-select";

interface Props {
  doc: HighTexDocument;
  onRename: (id: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onExport: (id: string, format?: ContentFormat) => Promise<void>;
  onCategoryChange?: (id: string, category: string) => Promise<void>;
  selectMode: boolean;
}

export const Row = ({ doc, onRename, onDelete, onExport, selectMode }: Props) => {
  const navigate = useNavigate();

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(doc.title);
  const [altTitle, setAltTitle] = useState(doc.altTitle ?? "");

  const [keywordsId, setKeywordsId] = useState<string[]>(
    doc.keywords.indonesian ?? [],
  );
  const [keywordsEn, setKeywordsEn] = useState<string[]>(
    doc.keywords.english ?? [],
  );

  const [inputId, setInputId] = useState("");
  const [inputEn, setInputEn] = useState("");

  const inputIdRef = useRef<HTMLInputElement>(null);
  const inputEnRef = useRef<HTMLInputElement>(null);

  const addKeyword = (lang: "id" | "en") => {
    if (lang === "id") {
      const trimmed = inputId.trim();
      if (!trimmed || keywordsId.includes(trimmed)) return;
      if (keywordsId.length == 5)
        throw new ShouldNotified({
          message: t("error.keyword.add_failed"),
          description: t("error.keyword.add_failed_desc", { max: 5 }),
        });
      setKeywordsId((prev) => [...prev, trimmed]);
      setInputId("");
      inputIdRef.current?.focus();
    } else {
      const trimmed = inputEn.trim();
      if (!trimmed || keywordsEn.includes(trimmed)) return;
      if (keywordsEn.length == 5)
        throw new ShouldNotified({
          message: t("error.keyword.add_failed"),
          description: t("error.keyword.add_failed_desc", { max: 5 }),
        });
      setKeywordsEn((prev) => [...prev, trimmed]);
      setInputEn("");
      inputEnRef.current?.focus();
    }
  };

  const removeKeyword = (lang: "id" | "en", kw: string) => {
    if (lang === "id") setKeywordsId((prev) => prev.filter((k) => k !== kw));
    else setKeywordsEn((prev) => prev.filter((k) => k !== kw));
  };
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

      const exists = data.some((c) => String(c.id) === String(doc.category));

      if (exists) {
        setCategory(String(doc.category));
      } else {
        setCategory(String(data[0].id));
      }
    })();
  }, [doc.category]);

  const [expanded, setExpanded] = useState(false);

  const updatedAt = doc.updatedAt
    ? new Date(doc.updatedAt).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    : null;

  const generatePdf = async (waterMark: boolean = false) => {
    const renderProgressToast = (status: string, progress: number) => (
      <div className="flex flex-col gap-1.5 w-full min-w-60">
        <div className="flex justify-between items-center text-xs font-semibold">
          <span className="truncate pr-2">{status}</span>
          <span className="text-neutral-500 font-mono">{progress}%</span>
        </div>
        <div className="w-full bg-neutral-200 dark:bg-neutral-700 h-2 rounded-full overflow-hidden">
          <div
            className="bg-black dark:bg-white h-full transition-all duration-300 rounded-full"
            style={{ width: `${Math.max(progress, 5)}%` }}
          />
        </div>
      </div>
    );

    const toastId = toast.loading(
      renderProgressToast("Menyiapkan ekspor PDF...", 5),
    );

    const unsubscribe = window.hightex.onPdfProgress((update) => {
      const prog = update.progress ?? 0;
      toast.loading(renderProgressToast(update.status, prog), {
        id: toastId,
      });
    });

    try {
      const result = await window.ipcRenderer.invoke(
        "hightex:pdf",
        doc.id,
        waterMark,
      );

      if (!result) {
        toast.dismiss(toastId);
        toast.info("Ekspor PDF dibatalkan", { duration: 3000 });
        return;
      }

      toast.success(
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-sm">PDF Berhasil Disimpan!</span>
          <span className="text-xs text-neutral-500 truncate max-w-60">
            {result.filename}
          </span>
        </div>,
        {
          id: toastId,
          duration: 15000,
          action: {
            label: "Buka File",
            onClick: () => window.file?.openPath?.(result.path),
          },
          cancel: {
            label: "Buka Folder",
            onClick: () => window.file?.showInFolder?.(result.path),
          },
        },
      );
    } catch (e) {
      if (e instanceof Error) {
        const parts = e.message.split(":");
        e = parts[parts.length - 1] || e.message;
      }
      toast.error(t("common.export_failed"), {
        description() {
          return truncate(ApplicationError.normilize(e), 150);
        },
        id: toastId,
        duration: 8000,
      });
    } finally {
      unsubscribe();
    }
  };

  const { selected, toggleSelect } = useMultiSelect<string>("documents");
  const isSelected = selected.includes(doc.id);

  const handleExpand = () => {
    setExpanded((prv) => !prv);
  };

  return (
    <div
      onClick={() => selectMode && toggleSelect(doc.id)}
      className={cn(
        "group rounded-xl  px-4 py-3 transition-all max-h-max cursor-pointer",
        isSelected && selectMode
          ? "bg-neutral-100 dark:bg-neutral-800/60"
          : "border-transparent hover:bg-neutral-100 dark:hover:bg-neutral-900/60",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors",
              isSelected && selectMode
                ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                : "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900",
              !selectMode &&
              "cursor-pointer hover:border-neutral-300 hover:bg-neutral-200 dark:hover:border-neutral-700 dark:hover:bg-neutral-800",
            )}
            onClick={(e) => {
              if (!selectMode) {
                e.stopPropagation();
                handleExpand();
                return;
              }
            }}
          >
            {selectMode ? (
              isSelected ? (
                <CircleCheck size={16} />
              ) : (
                <CircleMinus size={16} className="text-neutral-400 dark:text-neutral-500" />
              )
            ) : expanded ? (
              <FileText size={16} className="text-neutral-500 dark:text-neutral-400" />
            ) : (
              <File size={16} className="text-neutral-500 dark:text-neutral-400" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            {editing ? (
              <Textarea
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
                className="w-full bg-transparent text-sm my-2 font-medium text-neutral-900 outline-none dark:text-neutral-100"
              />
            ) : (
              <div
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (!selectMode) setEditing(true);
                }}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "truncate text-sm font-medium text-neutral-900 dark:text-neutral-100",
                  !selectMode && "cursor-text",
                )}
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
                      await HighTexDB.getInstance().updateDocument({
                        ...doc,
                        category: value,
                      });
                      toast.success("Category updated");
                    } catch {
                      setCategory(previous);
                      throw new ShouldNotified(t("error.category.update_failed"));
                    }
                  }}
                >
                  <SelectTrigger
                    onClick={(e) => e.stopPropagation()}
                    className="h-6 w-35 border-neutral-200 text-[11px] dark:border-neutral-700"
                  >
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectGroup>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name} - {t(`common.${c.variant}`)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}

              {updatedAt && (
                <>
                  <span className="text-neutral-300 dark:text-neutral-600">•</span>
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

        <div
          className={cn(
            "flex items-center gap-1 transition-opacity",
            selectMode && "opacity-0 pointer-events-none",
          )}
        >
          <Dropdown
            align="right"
            width="max-content"
            trigger={
              <button
                onClick={(e) => e.stopPropagation()}
                className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-800"
              >
                <DownloadCloudIcon
                  size={14}
                  className="text-neutral-500 dark:text-neutral-300"
                />
              </button>
            }
          >
            <div className="rounded-lg border border-neutral-200 bg-white p-1 text-xs shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
              <DropdownItem onClick={() => onExport(doc.id)}>
                <div className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800">
                  <FileJson size={14} />
                  Export .hightex
                </div>
              </DropdownItem>

              <DropdownItem onClick={async () => await generatePdf()}>
                <div className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800">
                  <FileText size={14} />
                  Export .pdf
                </div>
              </DropdownItem>
              <DropdownItem onClick={async () => await generatePdf(true)}>
                <div className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800">
                  <FileText size={14} />
                  Export .pdf watermarked
                </div>
              </DropdownItem>
            </div>
          </Dropdown>

          <button
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-800"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/document/${doc.id}`);
            }}
          >
            <Pen size={14} className="text-neutral-500 dark:text-neutral-300" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(doc.id);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <Trash size={14} className="text-neutral-400 transition-colors hover:text-red-500" />
          </button>
        </div>
      </div>
      <div
        className={cn(
          "grid transition-all duration-200 ease-in-out",
          expanded && !selectMode ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div
            className="mt-1 space-y-3 px-1 pb-2 pt-3"
            onClick={(e) => e.stopPropagation()}
          >
            <ExpandRow label="Alt. Title">
              <input
                value={altTitle}
                onChange={(e) => setAltTitle(e.target.value)}
                placeholder="—"
                className="w-full bg-transparent text-xs text-neutral-700 placeholder:text-neutral-300 outline-none dark:text-neutral-300 dark:placeholder:text-neutral-600"
              />
            </ExpandRow>

            <ExpandRow label="Keywords ID">
              <KeywordField
                lang="id"
                keywords={keywordsId}
                input={inputId}
                inputRef={inputIdRef}
                onInputChange={setInputId}
                onAdd={() => addKeyword("id")}
                onRemove={(kw) => removeKeyword("id", kw)}
              />
            </ExpandRow>

            <ExpandRow label="Keywords EN">
              <KeywordField
                lang="en"
                keywords={keywordsEn}
                input={inputEn}
                inputRef={inputEnRef}
                onInputChange={setInputEn}
                onAdd={() => addKeyword("en")}
                onRemove={(kw) => removeKeyword("en", kw)}
              />
            </ExpandRow>

            <div className="flex justify-end pt-1">
              <Button
                onClick={async () => {
                  await HighTexDB.getInstance().updateDocument({
                    ...doc,
                    altTitle,
                    keywords: { indonesian: keywordsId, english: keywordsEn },
                    category: category ?? doc.category,
                  });
                  toast.success("Saved");
                }}
                className="text-[11px]"
              >
                Save changes
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ExpandRow = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex items-center gap-4 border-t border-neutral-100 pt-3 dark:border-neutral-800/60">
    <span className="w-24 shrink-0 text-[11px] text-neutral-400 dark:text-neutral-500">
      {label}
    </span>
    <div className="min-w-0 flex-1">{children}</div>
  </div>
);

const KeywordField = ({
  lang,
  keywords,
  input,
  inputRef,
  onInputChange,
  onAdd,
  onRemove,
}: {
  lang: "id" | "en";
  keywords: string[];
  input: string;
  inputRef: React.RefObject<HTMLInputElement>;
  onInputChange: (val: string) => void;
  onAdd: () => void;
  onRemove: (kw: string) => void;
}) => (
  <div className="flex flex-wrap items-center gap-1.5">
    {keywords.map((kw) => (
      <span
        key={kw}
        className="inline-flex items-center gap-1 border rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
      >
        {lang === "id" ? <ParsedItalic text={kw} /> : kw}
        <button
          onClick={() => onRemove(kw)}
          className="text-neutral-300 transition-colors hover:text-red-400 dark:text-neutral-600 dark:hover:text-red-400"
        >
          <X size={9} />
        </button>
      </span>
    ))}

    <input
      ref={inputRef}
      value={input}
      onChange={(e) => onInputChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onAdd();
        }
      }}
      placeholder={lang === "id" ? "tambah..." : "add..."}
      className="w-20 bg-transparent text-[11px] text-neutral-600 placeholder:text-neutral-300 outline-none dark:text-neutral-400 dark:placeholder:text-neutral-600"
    />
  </div>
);