import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRef, PDFString, type PDFPage } from "pdf-lib";

/** Copy only selected pages, then resolve internal links against that selection. */
export class SplitPages {
  private readonly copied = new Map<string, PDFPage>();
  private readonly links: { page: PDFPage; annotation: PDFDict; destination?: PDFArray }[] = [];

  constructor(private readonly source: PDFDocument, private readonly target: PDFDocument) {}

  async append(indexes: number[]) {
    const originals = indexes.map(index => {
      const page = this.source.getPage(index), annotations = page.node.Annots();
      const internal: { annotation: PDFDict; destination?: PDFArray }[] = [];
      const retained = (annotations?.asArray() ?? []).filter(ref => {
        const annotation = this.source.context.lookup(ref, PDFDict);
        const action = annotation.lookupMaybe(PDFName.of("A"), PDFDict);
        if (!annotation.has(PDFName.of("Dest")) && action?.get(PDFName.of("S"))?.toString() !== "/GoTo") return true;
        const destination = annotation.get(PDFName.of("Dest")) ?? action?.get(PDFName.of("D"));
        const resolved = destination && this.source.context.lookup(destination);
        internal.push({ annotation, destination: resolved instanceof PDFArray ? resolved : undefined });
        return false;
      });
      return { page, annotations, internal, retained };
    });
    try {
      // Copying a destination recursively can copy an excluded page and its text.
      // Detach internal links only during the copy; original.pdf keeps its links.
      originals.forEach(({ page, annotations, retained }) => {
        if (annotations) page.node.set(PDFName.of("Annots"), this.source.context.obj(retained));
      });
      const pages = await this.target.copyPages(this.source, indexes);
      pages.forEach((page, index) => {
        this.target.addPage(page);
        const original = originals[index];
        this.copied.set(original.page.ref.toString(), page);
        original.internal.forEach(link => this.links.push({ page, ...link }));
      });
    } finally {
      originals.forEach(({ page, annotations }) => {
        if (annotations) page.node.set(PDFName.of("Annots"), annotations);
      });
    }
  }

  finish() {
    for (const { page, annotation, destination } of this.links) {
      const ref = destination?.get(0);
      const target = ref instanceof PDFRef ? this.copied.get(ref.toString()) : undefined;
      const coordinates = destination?.asArray().slice(1);
      const rect = annotation.lookup(PDFName.of("Rect"), PDFArray).asRectangle();
      const link = this.target.context.obj({
        Type: "Annot", Subtype: "Link", P: page.ref,
        Rect: [rect.x, rect.y, rect.x + rect.width, rect.y + rect.height], Border: [0, 0, 0],
      });
      if (target && coordinates && coordinates.every(value => !(value instanceof PDFRef)))
        link.set(PDFName.of("Dest"), this.target.context.obj([target.ref, ...coordinates]));
      else
        link.set(PDFName.of("A"), this.target.context.obj({ S: "URI", URI: PDFString.of("#") }));
      page.node.addAnnot(this.target.context.register(link));
    }
    this.links.length = 0;
  }
}
