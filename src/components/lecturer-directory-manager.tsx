import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  loadLecturerDirectory,
  removeLecturer,
  useLecturerDirectory,
} from "@/hooks/use-lecturer-directory";
import { t } from "@/utils/lang";
import { name } from "@/utils/name";
import { PageHeader } from "./dashboard/page-header";
import { LecturerEditor } from "./lecturer-editor";
import { LecturerImportButton } from "./lecturer-import";
import { LecturerCloudButton } from "./lecturer-cloud";
import { LecturerSourceLabel } from "./lecturer-source";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { NativeSelect } from "./ui/native-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

export function LecturerDirectoryManager() {
  const directory = useLecturerDirectory();
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");
  const [editing, setEditing] = useState<LecturerDirectoryEntry | "new" | null>(
    null,
  );
  const [deleting, setDeleting] = useState<LecturerDirectoryEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const search = query.trim().toLocaleLowerCase();
  const matches = directory.data.filter(
    (row) =>
      (source === "all" || row.source.type === source) &&
      `${row.name} ${row.nip}`.toLocaleLowerCase().includes(search),
  );
  const pageSize = 100;
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(matches.length / pageSize) - 1),
  );
  const start = currentPage * pageSize;
  return (
    <div
      className="flex min-h-[65vh] flex-col gap-6"
      data-lecturer-directory-manager
    >
      <PageHeader
        title={t("lecturers.title")}
        description={t("lecturers.page_description")}
        actions={
          <>
            <LecturerImportButton
              disabled={directory.loading || !!directory.error}
            />
            <Button
              type="button"
              disabled={directory.loading || !!directory.error}
              onClick={() => setEditing("new")}
            >
              <Plus />
              {t("lecturers.add")}
            </Button>
          </>
        }
      />
      <LecturerCloudButton disabled={directory.loading || !!directory.error} />
      <section className="space-y-5">
        <div className="flex flex-wrap gap-3">
          <Input
            className="h-10 min-w-48 flex-1 border-0 bg-muted/35 dark:bg-muted/35"
            type="search"
            aria-label={t("lecturers.search")}
            placeholder={t("lecturers.search")}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
          <NativeSelect
            aria-label={t("lecturers.source_label")}
            wrapperClassName="w-full sm:w-44"
            className="border-0 bg-muted/35"
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">{t("lecturers.all_sources")}</option>
            <option value="manual">{t("lecturers.source_manual")}</option>
            <option value="file">{t("lecturers.source_file")}</option>
            <option value="cloud">{t("lecturers.source_cloud")}</option>
            {directory.data.some((row) => row.source.type === "unknown") && (
              <option value="unknown">{t("lecturers.source_unknown")}</option>
            )}
          </NativeSelect>
        </div>
        {directory.error ? (
          <div className="space-y-3 py-10 text-center" role="alert">
            <p className="text-sm text-muted-foreground">
              {t("lecturers.storage_error")}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadLecturerDirectory()}
            >
              {t("lecturers.retry")}
            </Button>
          </div>
        ) : directory.loading ? (
          <p
            className="py-10 text-center text-sm text-muted-foreground"
            role="status"
          >
            {t("lecturers.loading")}
          </p>
        ) : !matches.length ? (
          <p
            className="py-12 text-center text-sm text-muted-foreground"
            role="status"
          >
            {t(
              directory.data.length ? "lecturers.none" : "lecturers.empty_hint",
            )}
          </p>
        ) : (
          <ul className="space-y-1" aria-label={t("lecturers.title")}>
            {matches.slice(start, start + pageSize).map((row) => (
              <li
                key={row.id}
                data-lecturer-row
                className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-xl px-3 py-3 transition-colors hover:bg-muted/35 sm:grid-cols-[minmax(0,1fr)_minmax(0,13rem)_auto] sm:gap-x-6 sm:px-4"
              >
                <div className="min-w-0">
                  <p className="wrap-break-word text-sm font-medium leading-relaxed">
                    {name(row.name)}
                  </p>
                  <p className="mt-0.5 break-all text-xs tabular-nums text-muted-foreground">
                    {row.nip || t("lecturers.nip_missing")}
                  </p>
                </div>
                <div className="col-start-1 row-start-2 min-w-0 sm:col-start-2 sm:row-start-1">
                  <LecturerSourceLabel source={row.source} />
                </div>
                <div className="col-start-2 row-start-1 flex gap-1 text-muted-foreground sm:col-start-3 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 [@media(hover:none)]:opacity-100">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("lecturers.edit_person", { name: row.name })}
                    onClick={() => setEditing(row)}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("lecturers.delete_person", {
                      name: row.name,
                    })}
                    onClick={() => setDeleting(row)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {!directory.error && matches.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {t("lecturers.page_status", {
                from: start + 1,
                to: Math.min(start + pageSize, matches.length),
                total: matches.length,
              })}
            </span>
            {matches.length > pageSize && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={currentPage === 0}
                  onClick={() => setPage(currentPage - 1)}
                >
                  {t("lecturers.previous_page")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={start + pageSize >= matches.length}
                  onClick={() => setPage(currentPage + 1)}
                >
                  {t("lecturers.next_page")}
                </Button>
              </div>
            )}
          </div>
        )}
      </section>
      {editing && (
        <LecturerEditor
          entry={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
      <Dialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open && !busy) setDeleting(null);
        }}
      >
        <DialogContent showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle>
              {t("lecturers.delete_person", { name: deleting?.name })}
            </DialogTitle>
            <DialogDescription>{t("lecturers.delete_hint")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                if (!deleting || busy) return;
                setBusy(true);
                try {
                  await removeLecturer(deleting.id);
                  setDeleting(null);
                } catch {
                  toast.error(t("lecturers.delete_error"));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t("lecturers.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
