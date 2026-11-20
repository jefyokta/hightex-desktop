import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { getSchema } from "@tiptap/core";
import { ChapterExtensions } from "../../src/editor/chapter/chapter-extensions";
import { AbstractIndonesian, AbstractEnglish } from "../../src/compiler/sheets/abstracts";
import { Document } from "../../src/editor/document";
import { PrintableContextProvider } from "../../src/hooks/use-printable";
import { emptyAuthorProfile, resolveDocumentProfile } from "../../src/utils/document-profile";
import { AbstractIDBuilder } from "../../src/compiler/builder/abstract-id-builder";
import { AbstractENBuilder } from "../../src/compiler/builder/abstract-en-builder";
import type { SectionCompositionDefinition } from "../../shared/section-layout";
import "../../src/css/document-template.css";

/** Actual current abstract sheets and target builders; no legacy content parser. */
export function abstractCompositionInput(english: boolean) {
  const data: HighTexDocument = { id: "fixture", title: "EQP001 Penelitian Pagination Bersama",
    altTitle: "EQP001 Shared Pagination Research", category: "1", config: { statementDate: new Date("2026-01-02T00:00:00Z") },
    profile: { ...emptyAuthorProfile(), name: "EQP002 Penulis Pengujian", nim: "2200000001" },
    keywords: { indonesian: ["EQK001 Algoritma", "EQK002 Dokumen", "EQK003 Tata Letak"], english: ["EQK001 Algorithm", "EQK002 Document", "EQK003 Layout"] } };
  const context = Document.fromSnapshot(data, { id: 1, name: "Fixture", variant: "thesis", chapters: [] });
  const Sheet = english ? AbstractEnglish : AbstractIndonesian;
  const host = window.document.createElement("div"), root = createRoot(host);
  let html: string;
  try {
    flushSync(() => root.render(<PrintableContextProvider value={{ document: context,
      profile: resolveDocumentProfile(data), ready: true, pageMode: "full", inFrame: false }}><Sheet /></PrintableContextProvider>));
    html = host.innerHTML;
  } finally { root.unmount(); }
  const target = english ? new AbstractENBuilder().target : new AbstractIDBuilder().target;
  const composition: SectionCompositionDefinition = { html, bodySelector: target.selector };
  return { document: data, composition, schema: getSchema(ChapterExtensions.contentSchema(target.chapterId)) };
}
