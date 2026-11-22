import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDialogViewport } from "@/hooks/use-dialog-viewport";
import type { useCitationAuthors } from "@/hooks/use-citation-authors";
import { t } from "@/utils/lang";

export function CitationAuthorsDialog({ form }: { form: ReturnType<typeof useCitationAuthors> }) {
  const viewport = useDialogViewport();
  return (
    <Dialog open={form.open} onOpenChange={open => { if (!open) form.close(); }}>
      <DialogContent data-citation-authors style={viewport} className="flex flex-col overflow-hidden sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("editor.expandable.citation.edit_authors")}</DialogTitle>
          <DialogDescription>{t("editor.expandable.citation.author_hint")}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 space-y-2 overflow-y-auto">
          {form.authors.map((author, index) => (
            <div key={index} className="flex items-start gap-2 rounded-lg border p-2">
              <div className="min-w-0 flex-1">
                {typeof author === "string" ? (
                  <Input
                    aria-label={`${t("editor.expandable.citation.full_name")} ${index + 1}`}
                    placeholder={t("editor.expandable.citation.full_name")}
                    disabled={form.saving} value={author}
                    onChange={event => form.update(index, event.target.value)}
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      aria-label={`${t("editor.expandable.citation.first_name")} ${index + 1}`}
                      placeholder={t("editor.expandable.citation.first_name")}
                      disabled={form.saving} value={author.firstName}
                      onChange={event => form.update(index, { ...author, firstName: event.target.value })}
                    />
                    <Input
                      aria-label={`${t("editor.expandable.citation.last_name")} ${index + 1}`}
                      placeholder={t("editor.expandable.citation.last_name")}
                      disabled={form.saving} value={author.lastName}
                      onChange={event => form.update(index, { ...author, lastName: event.target.value })}
                    />
                  </div>
                )}
              </div>
              <Button type="button" variant="ghost" size="icon" disabled={form.saving}
                aria-label={`${t("editor.expandable.citation.remove_author")} ${index + 1}`}
                onClick={() => form.remove(index)}>
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={form.saving} onClick={() => form.add("person")}>
            <Plus className="size-4" />{t("editor.expandable.citation.add_person")}
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={form.saving} onClick={() => form.add("name")}>
            <Plus className="size-4" />{t("editor.expandable.citation.add_name")}
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={form.saving} onClick={form.close}>{t("common.cancel")}</Button>
          <Button disabled={form.saving} aria-busy={form.saving} onClick={form.save}>
            {t("editor.expandable.citation.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
