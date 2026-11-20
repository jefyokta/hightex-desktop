/** Identity of captured editor pages. The print host cannot choose page breaks. */
export function editorPDFIdentity(input: EditorPDFSnapshot): string {
  return JSON.stringify([
    input.version,
    input.documentId,
    input.sections,
    input.sourceHash,
    input.planHash,
    input.pages,
    input.title,
    input.author,
    input.html,
    input.presentation,
    input.projection,
  ]);
}

export class EditorPDFSnapshotError extends Error {
  readonly code = "editor-pdf.snapshot.invalid";
  readonly received: string;

  constructor(readonly path: string, readonly reason: string, value: unknown) {
    const received = describe(value);
    super(`Invalid editor PDF snapshot at ${path}: ${reason}; received ${received}`);
    this.name = "EditorPDFSnapshotError";
    this.received = received;
  }
}

/** Validate untrusted transport once at each receiving boundary, before reading its contents. */
export function validateEditorPDFSnapshot(value: unknown): asserts value is EditorPDFSnapshot {
  const input = record(value, "snapshot");
  if (input.version !== 3)
    throw new EditorPDFSnapshotError("version", "expected canonical snapshot version 3", input.version);
  text(input.documentId, "documentId", 256, false);
  const pages = integer(input.pages, "pages", 1, 1000);
  validateSections(input.sections, pages);
  text(input.title, "title", 4096);
  text(input.author, "author", 4096);
  text(input.html, "html", 64 * 1024 * 1024, false);
  const contexts = validateProjection(input.projection, pages);
  validatePresentation(input.presentation, contexts);
  for (const key of ["sourceHash", "planHash", "fingerprint"] as const) {
    if (typeof input[key] !== "string" || !/^[a-f0-9]{64}$/.test(input[key]))
      throw new EditorPDFSnapshotError(key, "expected 64 lowercase hexadecimal characters (SHA-256)", input[key]);
  }
}

function validateSections(value: unknown, pages: number) {
  const sections = array(value, "sections", 1, pages), ids = new Map<string, number>();
  let nextPage = 1;
  for (const [index, value] of sections.entries()) {
    const path = `sections[${index}]`, section = record(value, path);
    const id = text(section.id, `${path}.id`, 512, false);
    if (ids.has(id))
      throw new EditorPDFSnapshotError(`${path}.id`, `duplicates sections[${ids.get(id)}].id`, id);
    ids.set(id, index);
    if (section.firstPage !== nextPage)
      throw new EditorPDFSnapshotError(`${path}.firstPage`, `expected ${nextPage}, immediately after the preceding section`, section.firstPage);
    const count = integer(section.pages, `${path}.pages`, 1, pages);
    const labels = array(section.labels, `${path}.labels`, count, count);
    for (const [offset, label] of labels.entries()) text(label, `${path}.labels[${offset}]`, 64);
    nextPage += count;
  }
  if (nextPage !== pages + 1)
    throw new EditorPDFSnapshotError("sections", `section page counts must total pages (${pages})`, nextPage - 1);
}

function validateProjection(value: unknown, pages: number): number {
  const projection = record(value, "projection");
  const contexts = Array.from(array(projection.contexts, "projection.contexts", 1, pages), (value, index) => {
    const path = `projection.contexts[${index}]`, context = record(value, path);
    const count = integer(context.pages, `${path}.pages`, 1, pages);
    const width = dimension(context.width, `${path}.width`);
    const height = dimension(context.height, `${path}.height`);
    const stride = dimension(context.stride, `${path}.stride`);
    if (stride < height)
      throw new EditorPDFSnapshotError(`${path}.stride`, `must be at least height (${height})`, stride);
    return { pages: count, width, height, stride };
  });
  const seen = new Map<string, number>();
  const views = Array.from(array(projection.views, "projection.views", pages, pages), (value, index) => {
    const path = `projection.views[${index}]`, view = record(value, path);
    const context = integer(view.context, `${path}.context`, 0, contexts.length - 1);
    const page = integer(view.page, `${path}.page`, 1, contexts[context].pages);
    const key = `${context}:${page}`;
    if (seen.has(key))
      throw new EditorPDFSnapshotError(path, `context ${context}, page ${page} already belongs to projection.views[${seen.get(key)}]`, value);
    seen.set(key, index);
    return { context, page };
  });
  for (const [index, context] of contexts.entries())
    for (let page = 1; page <= context.pages; page++)
      if (!seen.has(`${index}:${page}`))
        throw new EditorPDFSnapshotError("projection.views", `missing context ${index}, page ${page}`, projection.views);

  const point = (value: Record<string, unknown>, path: string) => {
    const page = integer(value.page, `${path}.page`, 1, pages);
    const context = contexts[views[page - 1].context];
    const x = finite(value.x, `${path}.x`, 0, context.width);
    const y = finite(value.y, `${path}.y`, 0, context.height);
    return { page, x, y, context };
  };
  const ids = new Map<string, number>();
  for (const [index, value] of array(projection.targets, "projection.targets", 0, 200000).entries()) {
    const path = `projection.targets[${index}]`, target = record(value, path);
    const id = text(target.id, `${path}.id`, 512, false);
    if (ids.has(id)) continue;
    ids.set(id, index);
    point(target, path);
  }
  // human: ini karena target link nya gaada ya? ini validasi2an ginian gunanya apa sih?
  // Broken destinations are recoverable: the print host uses # and the assembler
  // omits their native annotation. Shape/geometry of usable annotations is checked here.
  for (const [index, value] of array(projection.links, "projection.links", 0, 200000).entries()) {
    const path = `projection.links[${index}]`, link = record(value, path);
    const target = text(link.target, `${path}.target`, 512);
    if (!ids.has(target)) continue;
    const { page, x, y, context } = point(link, path);
    const width = dimension(link.width, `${path}.width`);
    const height = dimension(link.height, `${path}.height`);
    if (x + width > context.width)
      throw new EditorPDFSnapshotError(`${path}.width`, `right edge ${x + width} exceeds page ${page} width ${context.width}`, width);
    if (y + height > context.height)
      throw new EditorPDFSnapshotError(`${path}.height`, `bottom edge ${y + height} exceeds page ${page} height ${context.height}`, height);
  }
  return contexts.length;
}

function validatePresentation(value: unknown, contexts: number) {
  for (const [index, page] of array(value, "presentation", contexts, contexts).entries()) {
    const path = `presentation[${index}]`;
    for (const [offset, value] of array(page, path, 0, 200000).entries()) {
      const boxPath = `${path}[${offset}]`;
      const box = array(value, boxPath, 4, 4);
      for (const [dimension, value] of box.entries()) finite(value, `${boxPath}[${dimension}]`, -10000000, 10000000);
    }
  }
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new EditorPDFSnapshotError(path, "expected an object", value);
  return value as Record<string, unknown>;
}

function array(value: unknown, path: string, min: number, max: number): unknown[] {
  if (!Array.isArray(value)) throw new EditorPDFSnapshotError(path, "expected an array", value);
  if (value.length < min || value.length > max)
    throw new EditorPDFSnapshotError(path, min === max ? `expected exactly ${min} entries` : `expected ${min} to ${max} entries`, value);
  return value;
}

function text(value: unknown, path: string, limit: number, allowEmpty = true): string {
  if (typeof value !== "string") throw new EditorPDFSnapshotError(path, "expected text", value);
  if (!allowEmpty && !value.length) throw new EditorPDFSnapshotError(path, "text must not be empty", value);
  if (value.length > limit) throw new EditorPDFSnapshotError(path, `text exceeds ${limit} characters`, value);
  return value;
}

function integer(value: unknown, path: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max)
    throw new EditorPDFSnapshotError(path, `expected an integer from ${min} to ${max}`, value);
  return value;
}

function finite(value: unknown, path: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max)
    throw new EditorPDFSnapshotError(path, `expected a finite number from ${min} to ${max}`, value);
  return value;
}

function dimension(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value >= 100000)
    throw new EditorPDFSnapshotError(path, "expected a finite dimension greater than 0 and less than 100000 px", value);
  return value;
}

function describe(value: unknown): string {
  if (value === undefined) return "missing value";
  if (value === null) return "null";
  if (Array.isArray(value)) return `array with ${value.length} entries`;
  if (typeof value === "string") return value.length <= 80 ? JSON.stringify(value) : `text with ${value.length} characters`;
  return typeof value === "object" ? "object" : String(value);
}
