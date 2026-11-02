import { NativeSelect } from "@/components/ui/native-select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Download,
  FilePlus2,
  FileStack,
  Import,
  Loader2,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
  CheckSquare2,
} from "lucide-react";
import {
  useId,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { toast } from "sonner";
import { Row } from "./rows";
import { DocumentDialog, type DocumentMetadata } from "./document-dialog";
import { PageHeader } from "@/components/dashboard/page-header";
import { useMultiSelect } from "@/hooks/use-multi-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { t, useAppLanguage } from "@/utils/lang";
import { filterDocuments, type DocumentSort } from "@/utils/document-list";

interface Props {
  documents: HighTexDocument[];
  categories: Category[];
  onSave: (id: string, metadata: DocumentMetadata) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onDeleteMany: (ids: string[]) => Promise<string[]>;
  onExport: (id: string) => Promise<boolean>;
  onImport: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  onCreate: (metadata: DocumentMetadata) => Promise<void>;
}

export const DocumentList = ({
  documents,
  categories,
  onSave,
  onDelete,
  onDeleteMany,
  onExport,
  onImport,
  onCreate,
}: Props) => {
  useAppLanguage();
  const selectVisibleId = useId();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<DocumentSort>("updated");
  const [selectMode, setSelectMode] = useState(false);
  const [dialog, setDialog] = useState<"new" | HighTexDocument | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const importRef = useRef<HTMLInputElement>(null);
  const { selected, setSelected, clear, toggleSelect } =
    useMultiSelect<string>("documents");
  const visible = useMemo(
    () => filterDocuments(documents, query, category, sort),
    [documents, query, category, sort],
  );
  const validSelection = selected.filter((id) =>
    documents.some((doc) => doc.id === id),
  );
  const allVisibleSelected =
    visible.length > 0 &&
    visible.every((doc) => validSelection.includes(doc.id));
  const cancelSelection = () => {
    clear();
    setSelectMode(false);
  };
  const run = async (action: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      await action();
    } catch (error) {
      console.error("Document action failed", error);
      toast.error(t("dashboard.action_failed"));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !dialog && !pending.current) {
        clear();
        setSelectMode(false);
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [dialog, clear]);

  const selectionActions = (
    <>
      <span className="text-sm font-medium" role="status">
        {t("dashboard.selected_count", { count: validSelection.length })}
      </span>
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2 px-1">
          <Checkbox
            id={selectVisibleId}
            disabled={busy || !visible.length}
            checked={
              allVisibleSelected
                ? true
                : visible.some((doc) => validSelection.includes(doc.id))
                  ? "indeterminate"
                  : false
            }
            onCheckedChange={() =>
              setSelected(
                allVisibleSelected
                  ? validSelection.filter(
                      (id) => !visible.some((doc) => doc.id === id),
                    )
                  : [
                      ...new Set([
                        ...validSelection,
                        ...visible.map((doc) => doc.id),
                      ]),
                    ],
              )
            }
          />
          <label htmlFor={selectVisibleId} className="cursor-pointer text-xs">
            {t(
              allVisibleSelected
                ? "dashboard.deselect_visible"
                : "dashboard.select_visible",
            )}
          </label>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || !validSelection.length}
          onClick={() =>
            void run(async () => {
              for (const id of validSelection) {
                if (!(await onExport(id))) return;
              }
              cancelSelection();
            })
          }
        >
          <Download />
          {t("common.export")}
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={busy || !validSelection.length}
          onClick={() =>
            void run(async () => {
              const deleted = await onDeleteMany(validSelection);
              const remaining = validSelection.filter(
                (id) => !deleted.includes(id),
              );
              setSelected(remaining);
              if (!remaining.length) setSelectMode(false);
            })
          }
        >
          <Trash2 />
          {t("dashboard.delete")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={busy}
          aria-label={t("common.cancel")}
          onClick={cancelSelection}
        >
          <X />
        </Button>
      </div>
    </>
  );

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={t("workspace.tagline")}
        title={t("dashboard.your_documents")}
        description={t("dashboard.documents_subtitle")}
        actions={
          <>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => importRef.current?.click()}
            >
              <Import />
              {t("dashboard.import_from_file")}
            </Button>
            <Button
              className="workspace-primary"
              data-tour="document-create"
              disabled={busy}
              onClick={() => setDialog("new")}
            >
              <FilePlus2 />
              {t("dashboard.new_document")}
            </Button>
          </>
        }
      />
      <input
        ref={importRef}
        type="file"
        accept=".hightex"
        className="hidden"
        disabled={busy}
        onChange={(event) => void run(() => onImport(event))}
      />
      {documents.length > 0 && (
        <section
          data-tour="document-filters"
          className="space-y-4"
          aria-label={t("dashboard.filters")}
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" />
              <Input
                type="search"
                value={query}
                disabled={busy}
                onChange={(event) => setQuery(event.target.value)}
                aria-label={t("dashboard.search")}
                placeholder={t("dashboard.search")}
                className="h-10 rounded-xl bg-background pr-3 pl-10"
              />
            </div>
            <div className="flex gap-2">
              <NativeSelect
                aria-label={t("dashboard.category")}
                disabled={busy}
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                wrapperClassName="min-w-0 flex-1 sm:w-44 sm:max-w-44"
                className="rounded-xl text-xs"
              >
                <option value="all">{t("dashboard.all_categories")}</option>
                {categories.map((item) => (
                  <option key={item.id} value={String(item.id)}>
                    {item.name} · {t(`common.${item.variant}`)}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect
                aria-label={t("dashboard.sort")}
                disabled={busy}
                value={sort}
                onChange={(event) =>
                  setSort(event.target.value as DocumentSort)
                }
                wrapperClassName="min-w-0 flex-1 sm:w-44 sm:max-w-44"
                className="rounded-xl text-xs"
              >
                <option value="updated">{t("dashboard.sort_updated")}</option>
                <option value="title">{t("dashboard.sort_title")}</option>
                <option value="oldest">{t("dashboard.sort_oldest")}</option>
              </NativeSelect>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground" role="status">
              {t("dashboard.result_count", {
                count: visible.length,
                total: documents.length,
              })}
            </p>
            {!selectMode && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy || !visible.length}
                onClick={() => {
                  clear();
                  setSelectMode(true);
                }}
              >
                <CheckSquare2 />
                {t("dashboard.select")}
              </Button>
            )}
          </div>
        </section>
      )}
      {selectMode && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/40 p-3">
          {busy && <Loader2 className="size-4 animate-spin" />}
          {selectionActions}
        </div>
      )}
      {documents.length === 0 ? (
        <div className="flex min-h-[45vh] flex-col items-center justify-center  px-6 py-16 text-center">
          <span className="workspace-brand-icon mb-5 flex size-14 items-center justify-center rounded-2xl">
            <FileStack className="size-6" />
          </span>
          <h2 className="text-lg font-semibold">
            {t("dashboard.empty_title")}
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {t("dashboard.no_documents")}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button
              className="workspace-primary"
              onClick={() => setDialog("new")}
            >
              <FilePlus2 />
              {t("dashboard.new_document")}
            </Button>
            <Button variant="ghost" onClick={() => importRef.current?.click()}>
              {t("dashboard.import_from_file")}
            </Button>
          </div>
        </div>
      ) : visible.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center  p-8 text-center">
          <SlidersHorizontal className="mb-4 size-6 text-muted-foreground" />
          <h2 className="font-medium">{t("dashboard.no_results")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("dashboard.try_filters")}
          </p>
          <Button
            variant="outline"
            className="mt-5"
            onClick={() => {
              setQuery("");
              setCategory("all");
            }}
          >
            {t("dashboard.clear_filters")}
          </Button>
        </div>
      ) : (
        <div
          className="overflow-hidden border-t border-border/60"
          aria-label={t("dashboard.your_documents")}
        >
          {visible.map((doc) => (
            <Row
              key={doc.id}
              doc={doc}
              categories={categories}
              selected={validSelection.includes(doc.id)}
              selectMode={selectMode}
              disabled={busy}
              onSelect={() => toggleSelect(doc.id)}
              onEdit={() => setDialog(doc)}
              onDelete={onDelete}
              onExport={onExport}
            />
          ))}
        </div>
      )}
      <p className="flex items-center justify-center gap-2 text-center text-[11px] text-muted-foreground">
        <span className="size-1 rounded-full bg-foreground/40" />
        {t("workspace.offline_ready")}
      </p>
      {dialog && (
        <DocumentDialog
          key={dialog === "new" ? "new" : dialog.id}
          document={dialog === "new" ? undefined : dialog}
          categories={categories}
          onClose={() => setDialog(null)}
          onSave={(metadata) =>
            dialog === "new" ? onCreate(metadata) : onSave(dialog.id, metadata)
          }
        />
      )}
    </div>
  );
};
