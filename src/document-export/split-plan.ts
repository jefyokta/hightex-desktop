export interface SplitRange {
  start: number;
  end: number;
}

export interface SplitPlan {
  payload: Record<string, unknown>;
  cover: SplitRange;
  publicRanges: SplitRange[];
  privateRanges: SplitRange[];
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function page(value: unknown, total: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > total)
    throw Error("Split metadata contains an invalid page");
  return value;
}

function range(value: unknown, total: number): SplitRange {
  if (!record(value)) throw Error("Split metadata contains an invalid range");
  const start = page(value.start, total), end = page(value.end, total);
  if (end < start) throw Error("Split metadata contains a reversed range");
  return { start, end };
}

/** Read at the PDF boundary. Canonical sections are semantic; legacy detail stays supported. */
export function readSplitPlan(subject: string | undefined, total: number): SplitPlan {
  const payload: unknown = JSON.parse(subject ?? "null");
  if (!record(payload)) throw Error("Missing HighTex split metadata");
  if (payload.kind === "editor-document-experimental") {
    if (payload.pages !== total || !Array.isArray(payload.sections) || !payload.sections.length)
      throw Error("Split section count does not match the PDF");
    let next = 1;
    const ids = new Set<string>();
    const sections = payload.sections.map((section: unknown) => {
      if (!record(section) || typeof section.id !== "string" || !section.id || ids.has(section.id))
        throw Error("Split section identity is invalid or duplicated");
      ids.add(section.id);
      const start = page(section.firstPage, total);
      if (typeof section.pages !== "number" || !Number.isInteger(section.pages) || section.pages < 1 || start !== next)
        throw Error("Split sections must cover consecutive pages");
      const end = page(start + section.pages - 1, total);
      next = end + 1;
      return { id: section.id, start, end };
    });
    if (next !== total + 1 || sections[0].id !== "cover")
      throw Error("Split metadata must include the cover and every PDF page");
    const chapters = sections.filter(section => /^[1-9]\d*$/.test(section.id));
    if (!chapters.length) throw Error("Split metadata has no chapters");
    const last = Math.max(...chapters.map(section => Number(section.id)));
    const privateChapter = (id: string) => /^[1-9]\d*$/.test(id) && Number(id) > 3 && Number(id) !== last;
    // Signed uploads replace the named originals. Other templates, including
    // validity, bibliography, appendices and CV, retain all their pages.
    const retained = sections.filter(section => !["cover", "statement", "consent"].includes(section.id));
    return {
      payload,
      cover: sections[0],
      publicRanges: retained.filter(section => !privateChapter(section.id)),
      privateRanges: retained.filter(section => privateChapter(section.id)),
    };
  }
  if (payload.kind !== undefined || !record(payload.detail) || !Array.isArray(payload.chapters) || !payload.chapters.length)
    throw Error("Missing legacy HighTex split metadata");
  const keys = Object.keys(payload.detail).sort((a, b) => Number(a) - Number(b));
  if (!keys.length || keys.some(key => !/^\d+$/.test(key))) throw Error("Invalid legacy chapter identities");
  const ranges = keys.map(key => range((payload.detail as Record<string, unknown>)[key], total));
  if (ranges.some((item, index) => index > 0 && item.start <= ranges[index - 1].end))
    throw Error("Legacy split ranges overlap or are out of order");
  const publicRanges = ranges.filter((_, index) => index <= 2 || index >= ranges.length - 2);
  if (ranges[0].start > 4) publicRanges.unshift({ start: 4, end: ranges[0].start - 1 });
  return {
    payload,
    cover: { start: 1, end: 1 },
    publicRanges,
    privateRanges: ranges.filter((_, index) => index > 2 && index < ranges.length - 2),
  };
}
