import { editorPDFPresentation } from "../../src/document-export/snapshot/presentation";

/** Fixture oracle; native export installs the captured layout without executing a geometry audit. */
export function assertEditorPDFPresentation(root: Element, expected: EditorPDFRect[][]) {
  const actual = editorPDFPresentation(root);
  if (actual.length !== expected.length)
    throw Error(`Print presentation: expected ${expected.length} surfaces, found ${actual.length}`);
  for (const [context, boxes] of actual.entries()) {
    if (boxes.length !== expected[context].length)
      throw Error(`Print presentation[${context}]: expected ${expected[context].length} boxes, found ${boxes.length}`);
    for (const [index, box] of boxes.entries())
      if (box.some((value, dimension) => Math.abs(value - expected[context][index][dimension]) > 0.75))
        throw Error(`Print presentation[${context}][${index}]: expected [${expected[context][index]}], found [${box}]`);
  }
}
