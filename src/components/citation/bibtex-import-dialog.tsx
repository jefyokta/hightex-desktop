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

type Props = {
  form: ReturnType<typeof useBibtexImport>;
  onImport: () => Promise<number>;
};

export const BibtexImportDialog = ({ form, onImport }: Props) => {
  const {
    open,
    setOpen,
    bibText,
    setBibText,
    doiLink,
    setDoiLink,
    close,
    handleFileChange,
    fetchFromDoi,
  } = form;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton
        className="max-w-none! flex h-[85vh] w-[70vw] flex-col overflow-hidden"
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
            />
          </label>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-6 py-5">
          <div className="w-full flex gap-2">
            <Input
              placeholder="From doi link"
              onChange={(e) => setDoiLink(e.target.value)}
            />
            <Button
              size="icon"
              disabled={!doiLink.trim()}
              onClick={fetchFromDoi}
            >
              <ArrowRight />
            </Button>
          </div>
          <Textarea
            value={bibText}
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

        <DialogFooter className="flex-none border-t px-6 py-4">
          <Button variant="outline" onClick={close}>
            {t("common.cancel")}
          </Button>

          <Button onClick={onImport}>{t("citation.import")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
