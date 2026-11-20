import { expect, test } from "bun:test";
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFString } from "pdf-lib";
import { PDFPageAssembly } from "../electron/pdf/page-assembly";

async function nativePage() {
  const document = await PDFDocument.create(), page = document.addPage([600, 840]);
  page.drawText("Selectable native text");
  for (const annotation of [
    { Type: "Annot", Subtype: "Link", Rect: [5, 5, 20, 20], Dest: [page.ref, PDFName.of("Fit")] },
    { Type: "Annot", Subtype: "Link", Rect: [20, 5, 40, 20], A: { S: "URI", URI: PDFString.of("https://example.com/resource") } },
  ]) page.node.addAnnot(document.context.register(document.context.obj(annotation)));
  return document.save();
}

test("native pages preserve external links and receive final cross-page destinations", async () => {
  const input = await nativePage(), assembly = await PDFPageAssembly.create();
  await assembly.append(input);await assembly.append(input);
  const assembled = await assembly.finish([{ id: "target", page: 2, x: 40, y: 80 }],
    [{ target: "target", page: 1, x: 20, y: 30, width: 80, height: 20 }]);
  const bytes = await assembled.save();
  const document = await PDFDocument.load(bytes), pages = document.getPages();
  expect(pages.length).toBe(2);
  const first = pages[0].node.Annots()!.asArray().map(ref => document.context.lookup(ref, PDFDict));
  expect(first.length).toBe(2);
  expect(pages[1].node.Annots()!.size()).toBe(1);
  const external = first[0].lookup(PDFName.of("A"), PDFDict);
  expect(external.lookup(PDFName.of("URI"), PDFString).decodeText()).toBe("https://example.com/resource");
  const destination = first[1].lookup(PDFName.of("Dest"), PDFArray);
  expect(destination.get(0).toString()).toBe(pages[1].ref.toString());
  expect(destination.get(2).toString()).toBe("30");
  expect(destination.get(3).toString()).toBe("780");
  expect(first[1].lookup(PDFName.of("Rect"), PDFArray).asArray().map(value => value.toString())).toEqual(["15", "802.5", "75", "817.5"]);
  await expect(assembly.append(input)).rejects.toThrow("closed");
});

test("a native strip becomes physical vector pages with external and rebuilt internal links", async () => {
  const native = await PDFDocument.create(), page = native.addPage([450, 1218]);
  page.drawText("FIRST NATIVE PAGE", { x: 30, y: 1100 });
  page.drawText("SECOND NATIVE PAGE", { x: 30, y: 482 });
  page.node.addAnnot(native.context.register(native.context.obj({
    Type: "Annot", Subtype: "Link", Rect: [30, 470, 120, 490],
    A: { S: "URI", URI: PDFString.of("https://example.com/second") },
  })));
  const assembly = await PDFPageAssembly.create();
  await assembly.append(await native.save(), { count: 2, height: 800, stride: 824 });
  const output = await assembly.finish([{ id: "second", page: 2, x: 40, y: 80 }],
    [{ target: "second", page: 1, x: 20, y: 30, width: 80, height: 20 }]);
  const restored = await PDFDocument.load(await output.save());
  expect(restored.getPages().map(page => page.getSize())).toEqual([
    { width: 450, height: 600 }, { width: 450, height: 600 },
  ]);
  const second = restored.getPage(1),
    external = restored.context.lookup(second.node.Annots()!.get(0), PDFDict);
  expect(external.lookup(PDFName.of("A"), PDFDict).lookup(PDFName.of("URI"), PDFString).decodeText())
    .toBe("https://example.com/second");
  expect(external.lookup(PDFName.of("Rect"), PDFArray).asRectangle()).toEqual({ x: 30, y: 470, width: 90, height: 20 });
  const internal = restored.context.lookup(restored.getPage(0).node.Annots()!.get(0), PDFDict);
  expect(internal.lookup(PDFName.of("Dest"), PDFArray).get(0).toString()).toBe(second.ref.toString());
});

test("off-page source targets fail before returning a PDF", async () => {
  const input = await nativePage();
  for (const targets of [
    [{ id: "same", page: 2, x: 0, y: 0 }],
    [{ id: "same", page: 1, x: -1, y: 0 }],
  ]) {
    const assembly = await PDFPageAssembly.create();await assembly.append(input);
    await expect(assembly.finish(targets, [])).rejects.toThrow();
    await expect(assembly.append(input)).rejects.toThrow("closed");
  }
});

test("missing destinations omit only the dead annotation and retain text and external links", async () => {
  const assembly = await PDFPageAssembly.create();
  await assembly.append(await nativePage());
  const document = await assembly.finish([], [
    { target: "deleted", page: 1, x: 0, y: 0, width: 5, height: 5 },
  ]);
  expect(document.getPageCount()).toBe(1);
  expect(document.getPages()[0].node.Annots()?.size()).toBe(1);
});

test("cancellation and disposal prevent stale pages or completed bytes from being published", async () => {
  const input = await nativePage(), task = new AbortController();
  const assembly = await PDFPageAssembly.create(task.signal);await assembly.append(input);
  task.abort(new Error("Source revision superseded"));
  await expect(assembly.finish([], [])).rejects.toThrow("superseded");
  assembly.dispose();
  const disposed = await PDFPageAssembly.create(), pending = disposed.append(input);
  disposed.dispose();await expect(pending).rejects.toThrow("closed");
  await expect(PDFPageAssembly.create(task.signal)).rejects.toThrow("superseded");
});

test("assembly refuses multiple-page viewports, empty output and racing calls", async () => {
  const input = await PDFDocument.create();input.addPage();input.addPage();
  const assembly = await PDFPageAssembly.create();
  await expect(assembly.append(await input.save())).rejects.toThrow("exactly one");
  await expect(assembly.finish([], [])).rejects.toThrow("empty");
  const racing = await PDFPageAssembly.create(), page = await nativePage(), pending = racing.append(page);
  await expect(racing.append(page)).rejects.toThrow("already processing");
  await expect(racing.finish([], [])).rejects.toThrow("pending");
  await pending;await racing.finish([], []);
});


test("duplicate destinations resolve native links to their first page owner", async () => {
  const assembly = await PDFPageAssembly.create(), page = await nativePage();
  await assembly.append(page);await assembly.append(page);
  const pdf = await assembly.finish([
    { id: "same", page: 1, x: 40, y: 80 }, { id: "same", page: 2, x: 60, y: 100 },
  ], [{ target: "same", page: 2, x: 20, y: 30, width: 80, height: 20 }]);
  const annotations = pdf.getPages()[1].node.Annots()!.asArray().map(ref => pdf.context.lookup(ref, PDFDict));
  const link = annotations.find(annotation => annotation.has(PDFName.of("Dest")))!;
  expect(link.lookup(PDFName.of("Dest"), PDFArray).get(0).toString()).toBe(pdf.getPages()[0].ref.toString());
});
