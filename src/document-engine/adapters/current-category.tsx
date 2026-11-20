import type { DocumentSection, EditorSection } from "@/types/document-engine";
import type { DocumentRenderModel } from "@/types/document-snapshot";
import { renderToStaticMarkup } from "react-dom/server";
import { Document } from "@/editor/document";
import { PrintableContextProvider } from "@/hooks/use-printable";
import { StaticPages } from "@/compiler/static-pages";
import { AbstractENBuilder } from "@/compiler/builder/abstract-en-builder";
import { AbstractIDBuilder } from "@/compiler/builder/abstract-id-builder";
import { ForewordBuilder } from "@/compiler/builder/foreword-builder";
import { PresentationBuilder } from "@/compiler/builder/presentation-builder";
import { ProfileCVPage } from "@/components/profile-cv-page";
import { AbbreviationRow } from "@/components/editor/non-tiptap-editor/abbreviation-row";
import { resolveDocumentProfile } from "@/utils/document-profile";
import { bibliographyContent } from "@/compiler/builder/bibliography-content";
import { contentAssets } from "@/utils/content-assets";
import { sortAliases } from "@/utils/sort-aliases";
import { aliasKey } from "@/utils/alias-key";
import type { ChapterRenderIssue } from "@/types/chapter-content";
import { editorCompositionDefinition } from "./abstract-composition";

/** Assemble current category content through its existing template/schema owners. */
export class DocumentSections {
  readonly sections: DocumentSection[] = [];
  readonly model: DocumentRenderModel;
  private readonly urls: string[] = [];
  readonly context: Document;

  constructor(input: {
    document: HighTexDocument;
    category: Category;
    model: DocumentRenderModel;
    version?: string;
  }) {
    this.context = Document.fromSnapshot(
      input.document,
      input.category,
      input.version,
    );
    const selected = input.model.chapters;
    this.model = input.model;
    const content = new Map(selected.map((item) => [item.id, item.content]));
    const profile = resolveDocumentProfile(input.document);
    const FrontPages = StaticPages.create(input.category.variant ?? "thesis");
    const root = document.createElement("div");
    root.innerHTML = renderToStaticMarkup(
      <PrintableContextProvider
        value={{
          document: this.context,
          profile,
          ready: true,
          pageMode: "full",
          inFrame: false,
        }}
      >
        <FrontPages />
      </PrintableContextProvider>,
    );
    const targets = [
      new AbstractENBuilder(),
      new AbstractIDBuilder(),
      new ForewordBuilder(),
      new PresentationBuilder(),
    ].map((builder) => builder.target);
    const represented = new Set<string>();
    const addEditor = (
      id: string,
      composition?: EditorSection["composition"],
    ) => {
      const chapter = this.context.chapters.find(
        (item) => item.getChapter() === id,
      );
      if (!chapter) throw Error(`Missing category chapter: ${id}`);
      represented.add(id);
      this.sections.push({
        id,
        title: chapter.title,
        chapter: id,
        kind: "editor",
        nodes: chapter.sourceContent(content.get(id)),
        className: chapter.getHtmlClass(),
        numbering: "roman",
        composition,
      });
    };
    Array.from(root.children).forEach((template, index) => {
      const target = targets.find((item) =>
        template.querySelector(item.selector),
      );
      const id =
        target?.chapterId ??
        (template.id ||
          template.querySelector("h1[id]")?.id ||
          `front-${index}`);
      const firstHeading =
        template.querySelector("h1[id]") ?? template.querySelector("h1");
      const title = firstHeading?.textContent?.trim() ?? "";
      if (firstHeading && !firstHeading.id) firstHeading.id = id;
      if (target) {
        if (["abstract", "abstract-en"].includes(target.chapterId)) {
          const nodes = content.get(target.chapterId);
          // The authored heading stays editable and occupies the template title slot.
          const headingFromSource =
            nodes?.[0]?.type === "heading" && nodes[0].attrs?.level === 1;
          addEditor(
            target.chapterId,
            editorCompositionDefinition(
              template as HTMLElement,
              target.selector,
              Boolean(headingFromSource),
            ),
          );
        } else addEditor(target.chapterId);
        return;
      }

      this.sections.push({
        id,
        title,
        kind: "template",
        html: template.outerHTML,
        numbering: id === "cover" ? "none" : "roman",
      });
    });
    // Include editable sections even when a variant has no dedicated template.
    for (const chapter of this.context.chapters.filter(
      (item) =>
        item.query.isStaticChapter() && !represented.has(item.getChapter()),
    )) {
      addEditor(chapter.getChapter());
    }
    for (const [id, title] of [
      ["toc", "DAFTAR ISI"],
      ["tot", "DAFTAR TABEL"],
      ["tof", "DAFTAR GAMBAR"],
    ])
      this.sections.push({
        id,
        title,
        kind: "template",
        numbering: "roman",
        index: id as "toc" | "tot" | "tof",
        html: `<h1 id="${id}" class="chapter">${title}</h1>`,
      });
    this.sections.push({
      id: "abbrevation",
      title: "DAFTAR SINGKATAN",
      kind: "template",
      numbering: "roman",
      html:
        '<h1 id="toa" class="chapter">DAFTAR SINGKATAN</h1>' +
        sortAliases(
          this.model.aliases.map((item) => ({
            ...item,
            key: aliasKey(item.key, this.model.document.id),
          })),
        )
          .map((item) =>
            renderToStaticMarkup(<AbbreviationRow item={item} standalone />),
          )
          .join(""),
    });
    for (const chapter of this.context.chapters.filter((item) =>
      item.query.isNormalChapter(),
    ))
      this.sections.push({
        id: chapter.getChapter(),
        title: chapter.title,
        chapter: chapter.getChapter(),
        className: chapter.getHtmlClass(),
        numbering: "arabic",
        counter: chapter.getNumber(),
        kind: "editor",
        nodes: chapter.sourceContent(content.get(chapter.getChapter())),
      });
    const used = contentAssets(selected).references;
    const issues: ChapterRenderIssue[] = [];
    const entries: string[] = [];
    for (const key of used) {
      const value = this.model.references[key];
      if (value) entries.push(value);
      else issues.push({ kind: "citation", key });
    }
    let bibliography: HTMLElement;
    let groupedIssue: ChapterRenderIssue | undefined;
    try {
      bibliography = bibliographyContent(entries);
    } catch {
      bibliography = bibliographyContent([]);
      const failures = issues.length;
      for (const key of used) {
        const value = this.model.references[key];
        if (!value) continue; // Missing records already have their own placeholder.
        try {
          const entry = bibliographyContent([value]);
          bibliography.lastElementChild!.append(
            ...Array.from(entry.lastElementChild!.childNodes),
          );
        } catch {
          issues.push({ kind: "citation", key });
        }
      }
      // If each record works alone, the combined formatter failed. Preserve all
      // individual entries and report the affected group instead of losing them.
      if (issues.length === failures) {
        groupedIssue = { kind: "citation", key: Array.from(used).join("|") };
        issues.push(groupedIssue);
      }
    }
    for (const issue of issues) {
      const fallback = document.createElement("p");
      fallback.textContent =
        issue === groupedIssue
          ? "Daftar pustaka ditampilkan per entri karena pemformatan gabungan gagal."
          : `[${issue.key || "?"}] — Referensi tidak tersedia`;
      fallback.style.color = "#b91c1c";
      bibliography.append(fallback);
    }
    this.sections.push({
      id: "bibliography",
      title: "DAFTAR PUSTAKA",
      kind: "template",
      numbering: "arabic",
      html: bibliography.outerHTML,
      issues,
    });
    const attachment = this.context.chapters.find((item) =>
      item.query.isAttachmentChapter(),
    );
    if (attachment)
      this.sections.push({
        id: "attachment",
        title: attachment.title,
        chapter: "attachment",
        className: attachment.getHtmlClass(),
        numbering: "appendix",
        kind: "editor",
        nodes: attachment.sourceContent(content.get("attachment")),
      });
    const photo = this.model.profilePicture;
    const pictureUrl = photo
      ? URL.createObjectURL(
          new Blob([new Uint8Array(photo.bytes)], { type: photo.mime }),
        )
      : "";
    if (pictureUrl) this.urls.push(pictureUrl);
    const cv = document.createElement("div");
    cv.innerHTML = renderToStaticMarkup(
      <ProfileCVPage
        id="document-cv"
        value={profile.cv}
        initialPictureUrl={pictureUrl}
      />,
    );
    const paper = cv.querySelector("[data-profile-cv-page] > div")!;
    this.sections.push({
      id: "cv",
      title: "DAFTAR RIWAYAT HIDUP",
      kind: "template",
      numbering: "none",
      html: paper.innerHTML,
    });
  }

  destroy() {
    this.urls.splice(0).forEach((url) => URL.revokeObjectURL(url));
  }
}
