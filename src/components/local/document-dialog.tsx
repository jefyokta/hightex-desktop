import { NativeSelect } from "@/components/ui/native-select";
import { useId, useRef, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { t } from "@/utils/lang";
import { ParsedItalic } from "@/utils/parse-italic";

export type DocumentMetadata = Pick<
  HighTexDocument,
  "title" | "altTitle" | "category" | "keywords"
>;

export const DocumentDialog = ({
  document,
  categories,
  onClose,
  onSave,
}: {
  document?: HighTexDocument;
  categories: Category[];
  onClose: () => void;
  onSave: (metadata: DocumentMetadata) => Promise<void>;
}) => {
  const prefix = useId();
  const [title, setTitle] = useState(document?.title ?? "");
  const [altTitle, setAltTitle] = useState(document?.altTitle ?? "");
  const [category, setCategory] = useState(
    String(document?.category ?? categories[0]?.id ?? ""),
  );
  const [keywordsId, setKeywordsId] = useState(
    document?.keywords?.indonesian ?? [],
  );
  const [keywordsEn, setKeywordsEn] = useState(
    document?.keywords?.english ?? [],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const saving = useRef(false);
  const [discardRequested, setDiscardRequested] = useState(false);
  const changed =
    JSON.stringify([title, altTitle, category, keywordsId, keywordsEn]) !==
    JSON.stringify([
      document?.title ?? "",
      document?.altTitle ?? "",
      String(document?.category ?? categories[0]?.id ?? ""),
      document?.keywords?.indonesian ?? [],
      document?.keywords?.english ?? [],
    ]);
  const requestClose = () => {
    if (busy) return;
    if (changed) setDiscardRequested(true);
    else onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) requestClose();
      }}
    >
      <DialogContent
        className="workspace max-h-[90dvh] overflow-y-auto rounded-2xl p-6 sm:max-w-xl"
        showCloseButton={!busy}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {t(document ? "dashboard.edit_document" : "dashboard.new_document")}
          </DialogTitle>
          <DialogDescription>
            {t(
              document
                ? "dashboard.edit_description"
                : "dashboard.create_description",
            )}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (saving.current || !title.trim() || !category) return;
            saving.current = true;
            setBusy(true);
            setError("");
            try {
              await onSave({
                title: title.trim(),
                altTitle: altTitle.trim(),
                category,
                keywords: { indonesian: keywordsId, english: keywordsEn },
              });
              onClose();
            } catch {
              setError(t("dashboard.save_failed"));
            } finally {
              saving.current = false;
              setBusy(false);
            }
          }}
          className="space-y-5"
        >
          <fieldset disabled={busy} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor={`${prefix}-title`}>
                {t("dashboard.document_title")}
              </Label>
              <Textarea
                id={`${prefix}-title`}
                autoFocus
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t("dashboard.title_placeholder")}
                className="min-h-20 resize-y text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${prefix}-category`}>
                {t("dashboard.category")}
              </Label>
              <NativeSelect
                id={`${prefix}-category`}
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                required
                wrapperClassName="w-full"
              >
                {!category && (
                  <option value="" disabled>
                    {t("dashboard.choose_category")}
                  </option>
                )}
                {category &&
                  !categories.some((item) => String(item.id) === category) && (
                    <option value={category}>
                      {t("dashboard.unavailable_category")}
                    </option>
                  )}
                {categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {t(`common.${item.variant}`)}
                  </option>
                ))}
              </NativeSelect>
              {!categories.length && (
                <p className="text-xs text-destructive">
                  {t("dashboard.no_categories")}
                </p>
              )}
            </div>
            {document && (
              <>
                <div className="space-y-2">
                  <Label htmlFor={`${prefix}-alt`}>
                    {t("dashboard.alt_title")}
                  </Label>
                  <Textarea
                    id={`${prefix}-alt`}
                    value={altTitle}
                    onChange={(event) => setAltTitle(event.target.value)}
                    className="min-h-16 text-sm"
                  />
                </div>
                <KeywordInput
                  label={t("dashboard.keywords_id")}
                  values={keywordsId}
                  italic
                  onChange={setKeywordsId}
                />
                <KeywordInput
                  label={t("dashboard.keywords_en")}
                  values={keywordsEn}
                  onChange={setKeywordsEn}
                />
              </>
            )}
          </fieldset>
          {discardRequested && (
            <div
              role="alert"
              className="space-y-3 rounded-lg border bg-muted/40 p-3"
            >
              <p className="text-sm">{t("dashboard.discard_question")}</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDiscardRequested(false)}
                >
                  {t("dashboard.keep_editing")}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={onClose}
                >
                  {t("dashboard.discard")}
                </Button>
              </div>
            </div>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          <DialogFooter className="m-0! rounded-none border-t bg-transparent px-0 pb-0 pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={requestClose}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              className="workspace-primary"
              disabled={
                busy ||
                !title.trim() ||
                !category ||
                (!document && !categories.length)
              }
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              {t(
                busy
                  ? "dashboard.saving"
                  : document
                    ? "dashboard.save_changes"
                    : "dashboard.create_document",
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

function KeywordInput({
  label,
  values,
  onChange,
  italic = false,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  italic?: boolean;
}) {
  const id = useId();
  const [input, setInput] = useState("");
  const add = () => {
    const keyword = input.trim();
    if (!keyword || values.includes(keyword) || values.length >= 5) return;
    onChange([...values, keyword]);
    setInput("");
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        <span className="text-xs text-muted-foreground">{values.length}/5</span>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((value) => (
            <span
              key={value}
              className="inline-flex max-w-full items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs"
            >
              <span className="truncate">
                {italic ? <ParsedItalic text={value} /> : value}
              </span>
              <button
                type="button"
                className="rounded p-0.5 hover:bg-background focus-visible:outline-2 focus-visible:outline-ring"
                aria-label={t("dashboard.remove_keyword", { keyword: value })}
                onClick={() =>
                  onChange(values.filter((item) => item !== value))
                }
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          id={id}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={values.length >= 5}
          onBlur={add}
          placeholder={t("dashboard.keyword_placeholder")}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={
            !input.trim() || values.length >= 5 || values.includes(input.trim())
          }
          onClick={add}
          aria-label={t("dashboard.add_keyword")}
        >
          <Plus />
        </Button>
      </div>
    </div>
  );
}
