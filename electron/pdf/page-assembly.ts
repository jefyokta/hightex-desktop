import { PDFDocument, PDFName, PDFDict, PDFArray } from "pdf-lib";

export interface PDFSourceTarget {
  readonly id: string;
  readonly page: number;
  readonly x: number;
  readonly y: number;
}

export interface PDFSourceLink {
  readonly target: string;
  readonly page: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Assemble native viewport bytes; only link annotations use the recorded source map. */
export class PDFPageAssembly {
  private busy = false;

  private constructor(private document: PDFDocument | undefined, private readonly signal?: AbortSignal) {}

  static async create(signal?: AbortSignal) {
    signal?.throwIfAborted();
    const document = await PDFDocument.create();
    signal?.throwIfAborted();
    return new PDFPageAssembly(document, signal);
  }

  private current() {
    this.signal?.throwIfAborted();
    if (!this.document) throw Error("PDF page assembly is closed");
    return this.document;
  }

  async append(bytes: Uint8Array, batch?: { count: number; height: number; stride: number }) {
    const document = this.current();
    if (this.busy) throw Error("PDF page assembly is already processing a page");
    this.busy = true;
    try {
      const input = await PDFDocument.load(bytes);
      this.current();
      if (input.getPageCount() !== 1) throw Error("A viewport must print exactly one native page");
      const page = input.getPage(0), annotations = page.node.Annots();
      if (batch && batch.count > 1) {
        const width = page.getWidth(), height = batch.height * .75;
        const boxes = Array.from({ length: batch.count }, (_, offset) => {
          const top = page.getHeight() - offset * batch.stride * .75;
          return { left: 0, right: width, top, bottom: top - height };
        });
        // One copier shares the strip's font/image resources across its physical pages.
        const embedded = page.node.Contents()
          ? await document.embedPages(Array(batch.count).fill(page), boxes) : undefined;
        for (const [offset, crop] of boxes.entries()) {
          this.current();
          const output = document.addPage([width, height]);
          if (embedded) output.drawPage(embedded[offset]);
          for (const ref of annotations?.asArray() ?? []) {
            const annotation = input.context.lookup(ref, PDFDict),
              action = annotation.lookupMaybe(PDFName.of("A"), PDFDict);
            if (action?.get(PDFName.of("S"))?.toString() !== "/URI") continue;
            const uri = action.lookup(PDFName.of("URI")),
              rect = annotation.lookup(PDFName.of("Rect"), PDFArray).asRectangle();
            if (!uri) continue;
            const left = Math.max(0, rect.x), right = Math.min(width, rect.x + rect.width),
              lower = Math.max(crop.bottom, rect.y), upper = Math.min(crop.top, rect.y + rect.height);
            if (right <= left || upper <= lower) continue;
            output.node.addAnnot(document.context.register(document.context.obj({
              Type: "Annot", Subtype: "Link", P: output.ref,
              Rect: [left, lower - crop.bottom, right, upper - crop.bottom], Border: [0, 0, 0],
              A: { S: "URI", URI: uri.clone() },
            })));
          }
        }
        return;
      }
      if (annotations) {
        // Native internal destinations belong to the temporary one-page document.
        const external = annotations.asArray().filter(ref => {
          const annotation = input.context.lookup(ref, PDFDict);
          const action = annotation.lookupMaybe(PDFName.of("A"), PDFDict);
          return action?.get(PDFName.of("S"))?.toString() === "/URI";
        });
        page.node.set(PDFName.of("Annots"), input.context.obj(external));
      }
      const [copied] = await document.copyPages(input, [0]);
      this.current();document.addPage(copied);
    } finally { this.busy = false; }
  }

  /** Transfer the assembled document; its caller sets metadata and serializes once. */
  async finish(targets: readonly PDFSourceTarget[], links: readonly PDFSourceLink[]): Promise<PDFDocument> {
    const document = this.current();
    if (this.busy) throw Error("Cannot finish PDF page assembly while a page is pending");
    this.busy = true;
    try {
      if (!document.getPageCount()) throw Error("Cannot finish an empty PDF page assembly");
      const anchors = new Map<string, PDFSourceTarget>();
      const point = (position: PDFSourceTarget | PDFSourceLink) => {
        if (!Number.isInteger(position.page) || position.page < 1 || position.page > document.getPageCount() ||
          ![position.x, position.y].every(value => Number.isFinite(value) && value >= 0)) throw Error("PDF source location is outside its recorded document");
        const page = document.getPage(position.page - 1);
        if (position.x * .75 > page.getWidth() + .75 || position.y * .75 > page.getHeight() + .75)
          throw Error("PDF source point is outside its recorded page");
      };
      for (const target of targets) {
        if (anchors.has(target.id)) continue;
        point(target);
        if (!target.id) throw Error("Empty PDF target");
        anchors.set(target.id, target);
      }
      for (const link of links) {
        const target = anchors.get(link.target);
        if (!target) continue;
        point(link);
        if (![link.width, link.height].every(value => Number.isFinite(value) && value > 0))
          throw Error("PDF link has invalid bounds");
        const page = document.getPage(link.page - 1), destination = document.getPage(target.page - 1);
        if ((link.x + link.width) * .75 > page.getWidth() + .75 || (link.y + link.height) * .75 > page.getHeight() + .75)
          throw Error("PDF link is outside its recorded page");
        const annotation = document.context.obj({
          Type: "Annot", Subtype: "Link", P: page.ref,
          Rect: [link.x * .75, page.getHeight() - (link.y + link.height) * .75,
            (link.x + link.width) * .75, page.getHeight() - link.y * .75],
          Border: [0, 0, 0],
          Dest: [destination.ref, PDFName.of("XYZ"), target.x * .75, destination.getHeight() - target.y * .75, null],
        });
        page.node.addAnnot(document.context.register(annotation));
      }
      this.current();return document;
    } finally { this.busy = false;this.dispose(); }
  }

  dispose() { this.document = undefined; }
}
