import { ChevronDown, Cloud, File, FilePlus2, Plus } from "lucide-react";
import { Dropdown, DropdownItem } from "../dropdown";
import { Row } from "./rows";
import { ChangeEvent } from "react";
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
  
  return (
    <div className="flex flex-col h-full min-h-0 rounded-xl">
      <div className="flex h-16 mb-4 items-start justify-between px-4 py-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Your Documents
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Local workspace stored in your device
          </p>
        </div>

        <div className="relative flex items-center text-xs rounded-lg bg-neutral-900 dark:bg-neutral-800 text-white hover:bg-neutral-800 dark:hover:bg-neutral-700 transition">
          <button
            onClick={onCreate}
            className="flex items-center gap-1 ps-3 pe-1 py-1.5"
          >
            <FilePlus2 size={14} />
            New
          </button>

          <Dropdown
            align="right"
            width={"max-content"}
            trigger={
              <button className="flex items-center justify-center px-2 py-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition">
                <ChevronDown size={14} />
              </button>
            }
          >
            <div className="p-1 text-xs bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800">
              <DropdownItem onClick={onCreate}>
                <div className="flex items-center gap-2 px-1 py-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition">
                  <Plus
                    size={14}
                    className="text-neutral-600 dark:text-neutral-400"
                  />

                  <span className="font-light text-neutral-700 dark:text-neutral-200">
                    Create Empty
                  </span>
                </div>
              </DropdownItem>

              <DropdownItem>
                <label
                  htmlFor="hightex:file"
                  className="flex items-center gap-2 px-1 py-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
                >
                  <File
                    size={14}
                    className="text-neutral-600 dark:text-neutral-400"
                  />

                  <span className="font-light text-neutral-700 dark:text-neutral-200">
                    Import from file
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
                <div className="flex items-center gap-2 px-1 py-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition">
                  <Cloud
                    size={14}
                    className="text-neutral-600 dark:text-neutral-400"
                  />

                  <span className="font-light text-neutral-700 dark:text-neutral-200">
                    Import from Cloud
                  </span>
                </div>
              </DropdownItem>
            </div>
          </Dropdown>
        </div>
      </div>

      <div className="flex-1 bg-neutral-50 p-2 dark:bg-neutral-900/50 overflow-y-auto rounded-2xl min-h-0 border border-transparent dark:border-neutral-800">
        {documents.length === 0 ? (
          <div className="p-6 text-xs text-neutral-400 dark:text-neutral-500">
            No documents yet. Create your first document to start writing.
          </div>
        ) : (
          documents.map((doc: HighTexDocument) => (
            <Row
              key={doc.id}
              doc={doc}
              onRename={onRename}
              onDelete={onDelete}
              onExport={onExport}
            />
          ))
        )}
      </div>
    </div>
  );
};
