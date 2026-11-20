import type { Editor } from "@tiptap/core";
import { sha256Text } from "@/utils/sha256";
import type { DocumentEngine } from "@/document-engine";
import { Document } from "../editor/document";
import type { DocumentEngineOptions } from "@/types/document-engine";
import { DocumentRenderSession } from "./document-render";
import { prepareEditorExport } from "./source/prepare-editor";
import { prepareDocumentExport } from "./source/prepare-document";
import { captureDocumentContexts } from "./snapshot/capture-contexts";

/** Product export: freeze input, invoke the document engine, then package native print data. */
export async function captureDocumentPDF(
  editor: Editor | Document,
  signal: AbortSignal,
  hooks?: (engine: DocumentEngine) => void,
  options: DocumentEngineOptions = {},
): Promise<EditorPDFSnapshot> {
  const configuration = structuredClone(options);
  const input =
    editor instanceof Document
      ? await prepareDocumentExport(editor, signal)
      : await prepareEditorExport(editor, signal);
  const rendering = new DocumentRenderSession(input);
  try {
    const engine = await rendering.render(signal, configuration, hooks);
    return await captureDocumentContexts(
      engine.documentPages,
      {
        documentId: input.data.id,
        sections: [...engine.sections],
        sourceHash: input.sourceHash,
        planHash: await sha256Text(
          JSON.stringify([
            input.sourceHash,
            input.baseGeometry,
            engine.identity,
            engine.sections,
          ]),
        ),
        title: input.data.title,
        author: input.data.profile?.name ?? "",
      },
      input.resources,
      input.appearance,
      signal,
    );
  } finally {
    rendering.destroy();
  }
}
