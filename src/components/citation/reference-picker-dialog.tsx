import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useConfig } from "@/hooks/use-config";
import { useDialogViewport } from "@/hooks/use-dialog-viewport";
import { t } from "@/utils/lang";
import { ReferencePicker } from "./reference-picker";

export function ReferencePickerDialog({ open, onOpenChange, onChoose }: {
  open: boolean;
  onOpenChange(open: boolean): void;
  onChoose(key: string): void;
}) {
  const [query, setQuery] = useState("");
  const { config } = useConfig();
  const viewport = useDialogViewport();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-reference-picker-dialog style={viewport} className="flex flex-col overflow-hidden sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("editor.inline.citation_add")}</DialogTitle>
          <DialogDescription>{t("citation.search_hint")}</DialogDescription>
        </DialogHeader>
        {open && <ReferencePicker query={query} onQueryChange={setQuery} zotero={config?.zotero} onChoose={onChoose} />}
      </DialogContent>
    </Dialog>
  );
}
