import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { t } from "@/utils/lang";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight } from "lucide-react";
import type { useBibtexImport } from "@/hooks/use-bibtex-import";
import { useDialogViewport } from "@/hooks/use-dialog-viewport";

type Props = {
  form: ReturnType<typeof useBibtexImport>;
};

export const BibtexImportDialog = ({ form }: Props) => {
  const viewport = useDialogViewport();
  const {
    open,
    bibText,
    setBibText,
    doiLink,
    setDoiLink,
    close,
    handleFileChange,
    fetchFromDoi,
  } = form;
  return (
    <Dialog open={open} onOpenChange={form.onOpenChange}>
      <DialogContent
        showCloseButton
        style={viewport}
        className="flex h-[85dvh] w-[calc(100%-2rem)] max-w-3xl! flex-col overflow-hidden p-0"
      >
        <DialogHeader className="flex-none border-b px-6 py-5">
          <DialogTitle>{t("citation.import_title")}</DialogTitle>

          <DialogDescription>
            {t("citation.import_description")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-none items-center justify-between gap-3 border-b px-6 py-4">
          <label className="text-sm font-medium">
            {t("citation.bibtex_content")}
          </label>

          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs font-medium transition hover:bg-muted">
            {t("citation.upload_bib")}
            <input
              type="file"
              accept=".bib,application/x-bibtex,text/x-bibtex"
              className="hidden"
              onChange={handleFileChange}
              disabled={form.importing}
            />
          </label>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-6 py-5">
          <div className="w-full flex gap-2">
            <Input
              placeholder={t("citation.doi_placeholder")}
              value={doiLink}
              disabled={form.importing}
              onChange={(e) => setDoiLink(e.target.value)}
            />
            <Button
              size="icon"
              disabled={form.importing || !doiLink.trim()}
              onClick={fetchFromDoi}
            >
              <ArrowRight />
            </Button>
          </div>
          <Textarea
            value={bibText}
            disabled={form.importing}
            onChange={(event) => setBibText(event.target.value)}
            placeholder={t("citation.bibtex_placeholder")}
            className="min-h-0 flex-1 resize-none font-mono text-sm"
          />

          <div className="flex flex-none items-center justify-between rounded-xl border bg-muted/30 px-4 py-3 text-sm">
            <div className="text-muted-foreground">
              {t("citation.validation_description")}
            </div>

            <Badge variant="secondary">BibTeX</Badge>
          </div>
        </div>

        <DialogFooter className="m-0 flex-none border-t px-6 py-4">
          <Button variant="outline" onClick={close} disabled={form.importing}>
            {t("common.cancel")}
          </Button>

          <Button onClick={form.submit} disabled={form.importing || !bibText.trim()} aria-busy={form.importing}>
            {t("citation.import")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
