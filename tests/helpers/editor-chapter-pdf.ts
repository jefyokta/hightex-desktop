import { capturedChapterNodeViews } from "./captured-chapter-node-views";
import type { Editor } from "@tiptap/core";
import { PageFragments } from "./legacy-pagination/fragments";
import { prepareEditorExport } from "../../src/document-export/source/prepare-editor";
import { captureMaterializedPages } from "./capture-materialized-pages";
import { sha256Text } from "@/utils/sha256";
import { ReadOnlyChapter } from "../../src/editor/chapter/read-only-chapter";
import { paginationKey } from "../../src/editor/pagination/state";
import { paginationSection } from "../../src/editor/pagination/section-context";
import { getEditorChapter } from "../../src/editor/event";
import { paginationGeometry, applyPageGeometry } from "../../src/editor/pagination/options";
import { waitForPrintImages } from "../../src/compiler/print-resources";

function pageOutput() {
  const output = document.createElement("main");
  output.className = "editor-pdf-pages";
  output.style.cssText = "position:absolute;left:-100000px;top:0";
  document.body.append(output);
  return output;
}

/** Bounded diagnostic used by native equivalence fixtures; not the product export. */
export async function captureEditorChapterPDF(
  editor: Editor,
  signal: AbortSignal,
): Promise<EditorPDFSnapshot> {
  const input = await prepareEditorExport(editor, signal);
  const source = editor.state.doc;
  const { layout: plan, options } = paginationKey.getState(editor.state)!;
  const geometry = paginationGeometry(options, paginationSection(editor.view.dom.closest(".page")));
  const chapterId = getEditorChapter(editor)!.getId();
  const output = pageOutput();
  const host = pageOutput();
  const paper = editor.view.dom.closest<HTMLElement>(".page")!.cloneNode(false) as HTMLElement;
  paper.removeAttribute("id");
  paper.dataset.paginationSurface = "";
  applyPageGeometry(paper, geometry);
  host.append(paper);
  let chapter: ReadOnlyChapter | undefined;
  let fragments: PageFragments | undefined;
  try {
    chapter = new ReadOnlyChapter(paper, source, input.model, undefined, undefined, capturedChapterNodeViews(source, editor.view, document));
    await waitForPrintImages(paper, signal);
    chapter.applyLayout(source, plan);
    fragments = new PageFragments(chapter, geometry);
    await fragments.render(output, signal);
    return await captureMaterializedPages(
      output,
      {
        documentId: input.data.id,
        chapterId,
        sourceHash: input.sourceHash,
        planHash: await sha256Text(
          JSON.stringify([
            input.sourceHash,
            chapter.source.toJSON(),
            chapter.layout,
            geometry,
          ]),
        ),
        title: `${input.data.title} — ${input.active.id}`,
        author: input.data.profile?.name ?? "",
      },
      input.resources,
      input.appearance,
      signal,
    );
  } finally {
    fragments?.destroy();
    chapter?.destroy();
    output.remove();
    host.remove();
  }
}
