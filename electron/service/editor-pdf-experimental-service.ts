import { app, dialog } from "electron";
import { createHash, randomUUID } from "node:crypto";
import { rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { PDFPageAssembly } from "../pdf/page-assembly";
import { EditorPDFHost } from "../windows/editor-pdf-host";
import { ConfigService } from "./config-service";
import {
  editorPDFIdentity,
  validateEditorPDFSnapshot,
} from "../../shared/editor-pdf-contract";

/** 
 * Validate snapshots, print native PDF bytes and atomically save the chosen file. 
 */
export class EditorPDFExperimentalService {
  constructor(
    private readonly maxBatchPages = 4,
    private readonly progress: (value: EditorPDFProgress) => void = () => {},
  ) {}
  async export(input: EditorPDFSnapshot, signal: AbortSignal) {
    signal.throwIfAborted();
    const snapshot = this.validatedSnapshot(input);
    this.progress({stage:"destination",pages:snapshot.pages,completedPages:0});
    const chosen = await dialog.showSaveDialog({
      title: "Export PDF",
      defaultPath: join(
        ConfigService.get().export.saveFolder,
        `${snapshot.title.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120)}.pdf`,
      ),
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    signal.throwIfAborted();
    if (chosen.canceled || !chosen.filePath) return null;
    const bytes = await this.printSnapshot(snapshot, signal);
    signal.throwIfAborted();
    const temporary = join(
      dirname(chosen.filePath),
      `.hightex-editor-${randomUUID()}.tmp`,
    );
    try {
      this.progress({stage:"writing",pages:snapshot.pages,completedPages:snapshot.pages});
      await writeFile(temporary, bytes, { signal, flag: "wx" });
      signal.throwIfAborted();
      await rename(temporary, chosen.filePath);
    } finally {
      await rm(temporary, { force: true });
    }
    return { path: chosen.filePath, filename: basename(chosen.filePath) };
  }

  /** Development-only inspection of the exact snapshot used by the print host. */
  async debug(input: EditorPDFSnapshot, signal: AbortSignal): Promise<void> {
    if (app.isPackaged) throw Error("HTML inspection is available only in development");
    signal.throwIfAborted();
    const host = new EditorPDFHost(this.validatedSnapshot(input), true);
    try {
      await host.inspect(signal);
    } finally {
      host.destroy();
    }
  }

  private validatedSnapshot(input: EditorPDFSnapshot): EditorPDFSnapshot {
    validateEditorPDFSnapshot(input);
    const snapshot = structuredClone(input);
    if (
      createHash("sha256").update(editorPDFIdentity(snapshot)).digest("hex") !==
      snapshot.fingerprint
    )
      throw Error(`Editor PDF snapshot identity mismatch: fingerprint does not match content (document ${snapshot.documentId}, version ${snapshot.version})`);
    return snapshot;
  }

  async generate(
    input: EditorPDFSnapshot,
    signal: AbortSignal,
  ): Promise<Uint8Array> {
    signal.throwIfAborted();
    return this.printSnapshot(this.validatedSnapshot(input), signal);
  }

  /** Own one native print session; input has crossed validation exactly once. */
  private async printSnapshot(
    snapshot: EditorPDFSnapshot,
    signal: AbortSignal,
  ): Promise<Uint8Array> {
    const host = new EditorPDFHost(snapshot);
    try {
      this.progress({stage:"loading",pages:snapshot.pages,completedPages:0});
      await host.open(signal);
      return await host.run(async () => {
        const print = () => host.window.webContents.printToPDF({
          printBackground: true,
          preferCSSPageSize: true,
          displayHeaderFooter: false,
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
        });
        const pdf = await this.printProjectedPages(snapshot, host, print, signal);
        signal.throwIfAborted();
        if (pdf.getPageCount() !== snapshot.pages)
          throw Error(`Editor PDF page count changed: expected ${snapshot.pages}, native PDF contains ${pdf.getPageCount()}`);
        pdf.setTitle(snapshot.title.replace(/<[^>]*>/g, ""));
        pdf.setAuthor(snapshot.author);
        pdf.setCreator("HighTex Engine 2-beta");
        pdf.setProducer("HighTex");
        pdf.setSubject(
          JSON.stringify({
            kind: "editor-document-experimental",
            documentId: snapshot.documentId,
            sections: snapshot.sections,
            sourceHash: snapshot.sourceHash,
            planHash: snapshot.planHash,
            fingerprint: snapshot.fingerprint,
            pages: snapshot.pages,
            hasWm: Boolean(snapshot.watermark),
          }),
        );
        const bytes = await pdf.save();
        signal.throwIfAborted();
        return bytes;
      });
    } finally {
      host.destroy();
    }
  }

  /** Select and assemble canonical views; native printing never decides pagination. */
  private async printProjectedPages(
    snapshot: EditorPDFSnapshot,
    host: EditorPDFHost,
    print: () => Promise<Uint8Array>,
    signal: AbortSignal,
  ) {
    const assembly = await PDFPageAssembly.create(signal);
    this.progress({stage:"printing",pages:snapshot.pages,completedPages:0});
    try {
      for (const { index, count, view, geometry } of projectedBatches(snapshot, this.maxBatchPages)) {
        signal.throwIfAborted();
        const section = snapshot.sections.find(section =>
          index + 1 >= section.firstPage && index + 1 < section.firstPage + section.pages,
        );
        const range = count === 1 ? `page ${index + 1}/${snapshot.pages}`
          : `pages ${index + 1}..${index + count}/${snapshot.pages}`;
        const location = `${range} (section ${section?.id}, context ${view.context}, local page ${view.page})`;
        try {
          // executeJavaScript loses thrown renderer reasons. Return the reason explicitly.
          const failure = await host.run(() => host.window.webContents.executeJavaScript(`(()=>{
            try { window.editorPDFViewport.select(${index},${JSON.stringify(snapshot.fingerprint)}${count > 1 ? `,${count}` : ""});return null; }
            catch(error) { return error instanceof Error ? error.message : String(error); }
          })()`), `selecting ${location}`);
          if (failure) throw Error(failure);
          signal.throwIfAborted();
          await assembly.append(await host.run(print, `printing ${location}`), { count, ...geometry });
          signal.throwIfAborted();
          this.progress({stage:"printing",pages:snapshot.pages,completedPages:index+count});
        } catch (cause) {
          signal.throwIfAborted();
          throw new Error(`Editor PDF ${range}: ${cause instanceof Error ? cause.message : String(cause)} (section ${section?.id}, context ${view.context}, local page ${view.page})`, { cause });
        }
      }
      this.progress({stage:"assembling",pages:snapshot.pages,completedPages:snapshot.pages});
      return await host.run(
        () => assembly.finish(snapshot.projection.targets, snapshot.projection.links),
        `assembling ${snapshot.pages} native pages and links`,
      );
    } finally {
      assembly.dispose();
    }
  }

}

/** Keep native strips within one canonical context and the existing paper budget. */
export function* projectedBatches(snapshot: EditorPDFSnapshot, maxBatchPages = 4) {
  for (let index = 0; index < snapshot.pages;) {
    const view = snapshot.projection.views[index],
      geometry = snapshot.projection.contexts[view.context];
    const limit = Math.max(1, Math.min(maxBatchPages,
      Math.floor((12000 - geometry.height) / geometry.stride) + 1));
    let count = 1;
    while (count < limit && index + count < snapshot.pages) {
      const next = snapshot.projection.views[index + count];
      if (next.context !== view.context || next.page !== view.page + count) break;
      count++;
    }
    yield { index, count, view, geometry };
    index += count;
  }
}
