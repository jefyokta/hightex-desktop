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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { useZoteroImport } from "@/hooks/use-zotero-import";
import { useDialogViewport } from "@/hooks/use-dialog-viewport";
import { Input } from "@/components/ui/input";

type Props = { importer: ReturnType<typeof useZoteroImport> };

export const ZoteroImportDialog = ({ importer }: Props) => {
  const viewport = useDialogViewport();
  const {
    open,
    items,
    loading,
    importing,
    connected,
    selected,
    toggleSelect,
    clear,
    selectAll,
    refreshConnection,
    importSelected,
  } = importer;
  return (
    <Dialog open={open} onOpenChange={importer.onOpenChange}>
      <DialogContent
        showCloseButton
        style={viewport}
        className="flex h-[85dvh] w-[calc(100%-2rem)] max-w-3xl! flex-col gap-0 overflow-hidden p-0"
      >
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-xl">
                {t("citation.zotero.title")}
              </DialogTitle>

              <DialogDescription className="mt-1">
                {t("citation.zotero.description")}
              </DialogDescription>
            </div>

            <Badge
              variant={connected ? "default" : "destructive"}
              className="mt-1"
            >
              {connected === null
                ? t("citation.zotero.checking")
                : connected
                  ? t("citation.zotero.connected")
                  : t("citation.zotero.disconnected")}
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex shrink-0 items-center justify-between gap-4 border-b bg-muted/30 px-6 py-3">
          <div className="text-sm text-muted-foreground">
            {t("citation.zotero.local_api")}
          </div>

          <div className="flex gap-2">
            {selected.length > 0 && (
              <Button onClick={() => clear()} variant="destructive" size="sm" disabled={importing}>
                {t("citation.zotero.deselect_all")}
              </Button>
            )}

            {items.length > 0 && selected.length !== items.length && (
              <Button onClick={selectAll} size="sm" disabled={importing}>
                {t("citation.zotero.select_all")}
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              disabled={loading || importing}
              onClick={refreshConnection}
            >
              {loading
                ? t("citation.zotero.refreshing")
                : t("citation.zotero.refresh")}
            </Button>
          </div>
        </div>

        <div className="px-6 pt-4">
          <Input type="search" value={importer.query} disabled={importing}
            onChange={event => importer.setQuery(event.target.value)}
            aria-label={t("citation.search_hint")} placeholder={t("citation.search_hint")} />
          {(importer.searching || importer.searchUnavailable) && (
            <p role="status" className="mt-2 text-xs text-muted-foreground">
              {t(importer.searchUnavailable ? "citation.zotero.search_unavailable" : "citation.zotero.loading")}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-hidden px-6 py-4">
          <div className="flex h-full flex-col overflow-x-auto rounded-xl border bg-background">
            <div className="grid shrink-0 grid-cols-[1fr_120px_100px_70px] gap-4 border-b px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <div>{t("citation.zotero.title_column")}</div>
              <div>{t("citation.zotero.type_column")}</div>
              <div>{t("citation.zotero.year_column")}</div>
              <div />
            </div>

            <ScrollArea className="flex-1 overflow-scroll!">
              {loading ? (
                <div className="p-6 text-sm text-muted-foreground">
                  {t("citation.zotero.loading")}
                </div>
              ) : items.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">
                  {t("citation.zotero.empty")}
                </div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.key}
                    className="grid grid-cols-[1fr_120px_100px_70px] items-center gap-4 border-b px-4 py-3 transition hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {item.title || item.key}
                      </div>

                      <div className="mt-1 truncate font-mono text-xs text-muted-foreground">
                        {item.key}
                      </div>
                    </div>

                    <div>
                      <Badge variant="secondary" className="rounded-md">
                        {item.itemType ?? t("citation.zotero.reference")}
                      </Badge>
                    </div>

                    <div className="text-sm text-muted-foreground">
                      {item.date || "-"}
                    </div>

                    <div className="flex justify-end">
                      <Checkbox
                        checked={selected.includes(item.key)}
                        disabled={importing}
                        aria-label={item.title || item.key}
                        onCheckedChange={() => toggleSelect(item.key)}
                      />
                    </div>
                  </div>
                ))
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="m-0 shrink-0 border-t px-6 py-4">
          <Button variant="outline" onClick={() => importer.onOpenChange(false)} disabled={importing}>
            {t("common.cancel")}
          </Button>

          <Button
            onClick={importSelected}
            disabled={loading || importing || selected.length === 0}
            aria-busy={importing}
          >
            {t("citation.zotero.import_selected")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
