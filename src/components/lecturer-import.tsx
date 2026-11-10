import { Disclosure } from "@/components/ui/disclosure";
import { useId, useState } from "react";
import { FileUp } from "lucide-react";
import { toast } from "sonner";
import { importLecturers } from "@/hooks/use-lecturer-directory";
import {
  MAX_LECTURER_IMPORT_BYTES,
  parseLecturerImport,
} from "@/utils/lecturer-import";
import { t } from "@/utils/lang";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

export function LecturerImportButton({ disabled }: { disabled: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <FileUp />
        {t("lecturers.import")}
      </Button>
      {open && <LecturerImportDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function LecturerImportDialog({ onClose }: { onClose(): void }) {
  const id = useId();
  const [rows, setRows] = useState<{ name: string; nip: string }[] | null>(
    null,
  );
  const [filename, setFilename] = useState("");
  const [error, setError] = useState<string>();
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const busy = reading || saving;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        showCloseButton={!busy}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle>{t("lecturers.import")}</DialogTitle>
          <DialogDescription>{t("lecturers.import_hint")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={id}>{t("lecturers.import_file")}</Label>
          <Input
            id={id}
            type="file"
            accept=".json,application/json"
            disabled={busy}
            onChange={async (event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              setRows(null);
              setError(undefined);
              setFilename(file?.name ?? "");
              if (!file) return;
              if (file.size > MAX_LECTURER_IMPORT_BYTES) {
                setError(t("lecturers.import_size_error"));
                return;
              }
              setReading(true);
              try {
                setRows(parseLecturerImport(JSON.parse(await file.text())));
              } catch {
                setError(t("lecturers.import_invalid"));
              } finally {
                setReading(false);
              }
            }}
          />
          {rows && (
            <p className="text-sm" role="status">
              {t("lecturers.import_preview", {
                count: rows.length,
                file: filename,
              })}
            </p>
          )}
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
        <Disclosure
          contentClassName="space-y-2"
          className="space-y-2 text-xs text-muted-foreground"
          triggerClassName="cursor-pointer"
          label={t("lecturers.import_format_title")}
        >
          <p>{t("lecturers.import_format")}</p>
          <pre className="overflow-x-auto rounded-lg bg-muted p-3">
            {t("lecturers.import_example")}
          </pre>
          <p>{t("lecturers.import_duplicates")}</p>
        </Disclosure>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onClose}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            disabled={busy || !rows}
            onClick={async () => {
              if (!rows || busy) return;
              setSaving(true);
              setError(undefined);
              try {
                const result = await importLecturers(rows, filename);
                toast.success(
                  t("lecturers.import_success", {
                    added: result.added,
                    skipped: result.skipped,
                  }),
                );
                onClose();
              } catch {
                setError(t("lecturers.import_save_error"));
                setSaving(false);
              }
            }}
          >
            {t("lecturers.import_confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
