import { useId, useState } from "react";
import { toast } from "sonner";
import { saveLecturer } from "@/hooks/use-lecturer-directory";
import { t } from "@/utils/lang";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function LecturerEditor({
  entry,
  initialName = "",
  onClose,
  onSaved,
}: {
  entry?: LecturerDirectoryEntry;
  initialName?: string;
  onClose(): void;
  onSaved?(entry: LecturerDirectoryEntry): void;
}) {
  const id = useId();
  const [name, setName] = useState(entry?.name ?? initialName);
  const [nip, setNip] = useState(entry?.nip ?? "");
  const [saving, setSaving] = useState(false);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent showCloseButton={!saving}>
        <DialogHeader>
          <DialogTitle>
            {t(entry ? "lecturers.edit" : "lecturers.add")}
          </DialogTitle>
          <DialogDescription>{t("lecturers.editor_hint")}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (saving || !name.trim() || !nip.trim()) return;
            setSaving(true);
            try {
              const saved = await saveLecturer({
                ...(entry ? { id: entry.id } : {}),
                name,
                nip,
              });
              onSaved?.(saved);
              onClose();
            } catch {
              toast.error(t("lecturers.save_error"));
              setSaving(false);
            }
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-name`}>{t("lecturers.name_label")}</Label>
            <Input
              id={`${id}-name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={500}
              disabled={saving}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-nip`}>{t("lecturers.nip_label")}</Label>
            <Input
              id={`${id}-nip`}
              value={nip}
              onChange={(e) => setNip(e.target.value)}
              maxLength={200}
              required
              disabled={saving}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={onClose}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={saving || !name.trim() || !nip.trim()}
            >
              {t("lecturers.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
