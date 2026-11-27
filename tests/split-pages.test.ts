import { expect, test } from "bun:test";
import { PDFArray, PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { SplitPages } from "../src/document-export/split-pages";

test("split destinations follow copied pages without carrying excluded page objects", async () => {
  const source = await PDFDocument.create();
  const pages = [source.addPage(), source.addPage(), source.addPage()];
  pages.forEach((page, i) => page.drawText(["PUBLIC", "PRIVATE", "CLOSING"][i]));
  for (const target of [pages[1], pages[2]]) pages[0].node.addAnnot(source.context.register(source.context.obj({
    Type: "Annot", Subtype: "Link", P: pages[0].ref, Rect: [1, 2, 30, 40], Border: [0, 0, 0],
    Dest: [target.ref, PDFName.of("XYZ"), 12, 34, null],
  })));
  const originalLinks = pages[0].node.Annots()!.toString();
  const output = await PDFDocument.create(), copy = new SplitPages(source, output);
  await copy.append([0]);
  output.addPage(); // signed upload inserted between source pages
  await copy.append([2]);copy.finish();copy.finish();
  const reloaded = await PDFDocument.load(await output.save());
  const annotations = reloaded.getPage(0).node.Annots()!.asArray().map(ref => reloaded.context.lookup(ref, PDFDict));
  expect(annotations[0].lookup(PDFName.of("A"), PDFDict).get(PDFName.of("URI"))!.toString()).toBe("(#)");
  expect(annotations[1].lookup(PDFName.of("Dest"), PDFArray).get(0).toString()).toBe(reloaded.getPage(2).ref.toString());
  const pageObjects = reloaded.context.enumerateIndirectObjects().filter(([, object]) => object instanceof PDFDict && object.get(PDFName.of("Type"))?.toString() === "/Page");
  expect(pageObjects).toHaveLength(3);
  expect(pages[0].node.Annots()!.toString()).toBe(originalLinks);
  expect(source.getPageCount()).toBe(3);
});
