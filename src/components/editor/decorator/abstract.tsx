import { useState } from "react";
import { useDocumentKeywords, type KeywordLanguage } from "@/hooks/use-document-keywords";
import { ParsedItalic } from "@/utils/parse-italic";
import { useAppLanguage } from "@/hooks/use-app-language";
import { KeywordEditor } from "../keyword-editor";
import { t } from "@/utils/lang";

function AbstractKeyword({ documentId, language }: { documentId: string; language: KeywordLanguage }) {
  useAppLanguage();
  const { keywords = [], error } = useDocumentKeywords(documentId, language);
  const [anchor, setAnchor] = useState<HTMLElement>();
  return <>
    <p data-tour="editor-keywords" style={{ marginTop: "1em" }}>
      <button type="button" className="abstract-keyword-trigger" onClick={event => setAnchor(event.currentTarget)}
        title={t("editor.keywords.edit")} aria-label={t("editor.keywords.edit")}>
        <b>{language === "english" ? "Keywords" : "Kata Kunci"}: </b>{" "}
        {keywords.map((keyword, index) => <span key={index}>
          {language === "english" ? keyword : <ParsedItalic text={keyword} />}{index < keywords.length - 1 ? ", " : ""}
        </span>)}
      </button>
    </p>
    {error && <p data-editor-ui role="alert">{error}</p>}
    {anchor && <KeywordEditor documentId={documentId} language={language} anchor={anchor} onClose={() => setAnchor(undefined)} />}
  </>;
}

export const AbstractDecoratorID = ({ documentId }: { documentId: string }) => <AbstractKeyword documentId={documentId} language="indonesian" />;
export const AbstractDecoratorEN = ({ documentId }: { documentId: string }) => <AbstractKeyword documentId={documentId} language="english" />;
