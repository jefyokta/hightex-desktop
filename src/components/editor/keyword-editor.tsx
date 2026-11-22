import { useId, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useDocumentKeywords, type KeywordLanguage } from "@/hooks/use-document-keywords";
import { useAppLanguage } from "@/hooks/use-app-language";
import { ParsedItalic } from "@/utils/parse-italic";
import { t } from "@/utils/lang";
import "@/css/abstract-keywords.css";

export function KeywordEditor({ documentId, language, anchor, onClose }: {
  documentId: string;
  language: KeywordLanguage;
  anchor: HTMLElement;
  onClose(): void;
}) {
  useAppLanguage();
  const source = useDocumentKeywords(documentId, language);
  const virtualRef = useRef(anchor);
  virtualRef.current = anchor;
  return <Popover open onOpenChange={open => { if (!open) onClose(); }}>
    <PopoverAnchor virtualRef={virtualRef} />
    <PopoverContent data-editor-ui data-keyword-editor align="start" sideOffset={8}
      className="w-88 max-w-[calc(100vw-2rem)] p-4" onCloseAutoFocus={event => {
        event.preventDefault();
        if (anchor.isConnected) anchor.focus({ preventScroll: true });
      }}>
      {source.keywords ? <KeywordForm initial={source.keywords} language={language} onSave={source.save} onClose={onClose} />
        : <p role="status" className="text-xs text-muted-foreground">{source.error || t("common.loading")}</p>}
    </PopoverContent>
  </Popover>;
}

function KeywordForm({ initial, language, onSave, onClose }: {
  initial: string[];
  language: KeywordLanguage;
  onSave(values: string[]): Promise<void>;
  onClose(): void;
}) {
  const id = useId();
  const [values, setValues] = useState(initial);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const title = language === "english" ? "Keywords" : "Kata kunci";
  const pending = input.trim();
  const duplicate = values.some(value => value.toLocaleLowerCase() === pending.toLocaleLowerCase());
  const nextValues = pending && !duplicate && values.length < 5 ? [...values, pending] : values;
  const add = () => {
    if (!pending || duplicate || values.length >= 5) return;
    setValues(nextValues);
    setInput("");
    setError("");
  };
  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    try { await onSave(nextValues); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setSaving(false); }
  };

  return <div className="space-y-4">
    <header className="flex items-center justify-between gap-3">
      <div><h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t("editor.keywords.hint")}</p></div>
      <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs tabular-nums">{values.length}/5</span>
    </header>
    <div className="flex min-h-9 flex-wrap gap-2">
      {values.map((value, index) => <span key={`${index}:${value}`} className="inline-flex max-w-full items-center gap-1 rounded-lg border bg-muted/40 py-1 pl-2.5 pr-1 text-xs">
        <span className="break-words">{language === "english" ? <em>{value}</em> : <ParsedItalic text={value} />}</span>
        <Button type="button" size="icon-xs" variant="ghost" disabled={saving}
          aria-label={t("dashboard.remove_keyword", { keyword: value })} onClick={() => setValues(values.filter((_, position) => position !== index))}><X /></Button>
      </span>)}
      {!values.length && <p className="text-xs text-muted-foreground">{t("editor.keywords.empty")}</p>}
    </div>
    <div className="flex gap-2">
      <Input id={id} aria-label={title} value={input} disabled={saving || values.length >= 5}
        placeholder={t("editor.expandable.setting.add_keyword")} onChange={event => setInput(event.target.value)}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Enter" || event.key === ",") { event.preventDefault(); add(); }
        }} />
      <Button size="icon" variant="outline" disabled={saving || !pending || duplicate || values.length >= 5} onClick={add}
        aria-label={t("editor.expandable.setting.add_keyword")}><Plus /></Button>
    </div>
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    <footer className="flex justify-end gap-2 border-t pt-3">
      <Button size="sm" variant="ghost" disabled={saving} onClick={onClose}>{t("common.cancel")}</Button>
      <Button size="sm" disabled={saving} onClick={() => void save()}>{t(saving ? "editor.expandable.setting.saving" : "editor.expandable.setting.save")}</Button>
    </footer>
  </div>;
}
