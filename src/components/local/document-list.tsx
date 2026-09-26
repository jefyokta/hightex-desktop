import {
  ChevronDown,
  Cloud,
  File,
  FilePlus2,
  Plus,
  Check,
  Download,
  Trash2,
  X,
  FileStack,
} from "lucide-react";
import { Dropdown, DropdownItem } from "../dropdown";
import { Row } from "./rows";
import { ChangeEvent, useState } from "react";
import { t } from "@/utils/lang";
import { useMultiSelect } from "@/hooks/use-multi-select";
import { Button } from "../ui/button";
import { Manager } from "@/editor/manager";

interface Props {
  documents: HighTexDocument[];
  onRename: (id: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onExport: (id: string, format?: ContentFormat) => Promise<void>;
  onImport: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  onCreate: () => Promise<void>;
}

export const DocumentList = ({
  documents,
  onRename,
  onDelete,
  onCreate,
  onImport,
  onExport,
}: Props) => {
  const [selectMode, setSelectMode] = useState(false);

  const { selected, clear, addSelected } = useMultiSelect<string>("documents");

  const handleCancelSelect = () => {
    clear();
    setSelectMode(false);
  };

  const handleDeleteSelected = async () => {
    await Manager.deleteDocuments(...selected)
    clear();
    setSelectMode(false);
  };

  const handleExportSelected = async () => {
    for (const id of selected) {
      await onExport(id);
    }
    clear();
    setSelectMode(false);
  };

  return (
    <div className="flex flex-col h-full min-h-0 rounded-xl">
      <div className="flex h-16 mb-4 items-start justify-between px-4 py-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("dashboard.your_documents")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("dashboard.documents_subtitle")}
          </p>
        </div>

        <div className="relative flex items-center gap-2">
          <div
            className={`flex items-center gap-2 transition-all duration-200 ${
              selectMode
                ? "opacity-0 scale-95 pointer-events-none absolute"
                : "opacity-100 scale-100"
            }`}
          >
            <button
              onClick={() => setSelectMode(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
            >
              <Check size={14} />
              Select
            </button>

            <div className="flex items-center text-xs rounded-lg bg-neutral-900 dark:bg-neutral-800 text-white shadow-sm hover:shadow transition-shadow">
              <button
                onClick={onCreate}
                className="flex items-center gap-1 ps-3 pe-1 py-1.5 hover:bg-white/10 rounded-l-lg transition-colors"
              >
                <FilePlus2 size={14} />
                {t("common.new")}
              </button>

              <div className="w-px h-4 bg-white/15" />

              <Dropdown
                align="right"
                width={"max-content"}
                trigger={
                  <button className="flex items-center justify-center px-2 py-1.5 rounded-r-lg hover:bg-white/10 transition-colors">
                    <ChevronDown size={14} />
                  </button>
                }
              >
                <div className="p-1 text-xs bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 shadow-lg">
                  <DropdownItem onClick={onCreate}>
                    <div className="flex items-center gap-2 px-1.5 py-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                      <Plus
                        size={14}
                        className="text-neutral-600 dark:text-neutral-400"
                      />
                      <span className="font-light text-neutral-700 dark:text-neutral-200">
                        {t("dashboard.create_empty")}
                      </span>
                    </div>
                  </DropdownItem>

                  <DropdownItem>
                    <label
                      htmlFor="hightex:file"
                      className="flex items-center gap-2 px-1.5 py-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                    >
                      <File
                        size={14}
                        className="text-neutral-600 dark:text-neutral-400"
                      />
                      <span className="font-light text-neutral-700 dark:text-neutral-200">
                        {t("dashboard.import_from_file")}
                      </span>
                    </label>
                    <input
                      onChange={onImport}
                      type="file"
                      id="hightex:file"
                      className="hidden"
                      accept=".hightex,.htx,.htv2"
                    />
                  </DropdownItem>

                  <div className="my-1 h-px bg-neutral-200 dark:bg-neutral-800" />

                  <DropdownItem>
                    <div className="flex items-center gap-2 px-1.5 py-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                      <Cloud
                        size={14}
                        className="text-neutral-600 dark:text-neutral-400"
                      />
                      <span className="font-light text-neutral-700 dark:text-neutral-200">
                        {t("dashboard.import_from_cloud")}
                      </span>
                    </div>
                  </DropdownItem>
                </div>
              </Dropdown>
            </div>
          </div>

          <div
            className={`flex items-center gap-2 transition-all duration-200 ${
              selectMode
                ? "opacity-100 scale-100"
                : "opacity-0 scale-95 pointer-events-none absolute"
            }`}
          >
            <div className="flex items-center gap-1.5 mr-1 px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">
                {selected.length}
              </span>
              selected
            </div>

            <button
              onClick={handleExportSelected}
              disabled={selected.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <Download size={14} />
              Export
            </button>

            <button
              onClick={handleDeleteSelected}
              disabled={selected.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/30 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <Trash2 size={14} />
              Delete
            </button>

            <button
              onClick={handleCancelSelect}
              className="flex items-center justify-center p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-neutral-50 p-2 dark:bg-neutral-900/50 overflow-y-auto  rounded-2xl min-h-0 border border-transparent dark:border-neutral-800">
        {documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-6">
            <div className="p-3 rounded-full bg-neutral-100 dark:bg-neutral-800/60 mb-1">
              <FileStack
                size={20}
                className="text-neutral-400 dark:text-neutral-500"
              />
            </div>
            <p className="text-xs text-neutral-400 dark:text-neutral-500">
              {t("dashboard.no_documents")}
            </p>
          </div>
        ) : (
          <>
            {selectMode && (
              <div className="flex items-center justify-between px-2 py-2 mb-1 ">
                <span className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">
                  {documents.length} {t("dashboard.your_documents")}
                </span>
                <div className="flex gap-2">
                  <Button
                    disabled={selected.length === documents.length}
                    variant="default"
                    size="sm"
                    onClick={() => {
                      for (const doc of documents) {
                        addSelected(doc.id);
                      }
                    }}
                  >
                    Select All
                  </Button>
                  <Button
                    disabled={selected.length === 0}
                    variant="destructive"
                    size="sm"
                    onClick={() => clear()}
                  >
                    Deselect All
                  </Button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-0.5">
              {documents.map((doc) => (
                <Row
                  key={doc.id}
                  doc={doc}
                  selectMode={selectMode}
                  onRename={onRename}
                  onDelete={onDelete}
                  onExport={onExport}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};