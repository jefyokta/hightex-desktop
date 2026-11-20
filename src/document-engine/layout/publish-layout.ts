import type {
  SectionLayoutResult,
  SectionSourceLocator,
} from "../../../shared/section-layout";

const publishedLayouts = new WeakSet<SectionLayoutResult>();

/** Freeze compiler data at publication. Transport validation belongs to the receiving IPC boundary. */
export function freezeSectionLayout(input: SectionLayoutResult): Readonly<SectionLayoutResult> {
  if (publishedLayouts.has(input)) return input;
  const data = structuredClone(input);
  const { identity, geometry, effects } = data;
  if (!Number.isInteger(data.sourceSize) || data.sourceSize < 0 ||
      !Number.isInteger(data.pages) || data.pages < 1 ||
      ![geometry.width, geometry.height, geometry.stride].every(value => Number.isFinite(value) && value > 0) ||
      geometry.stride < geometry.height ||
      !Object.values(geometry.margins).every(value => Number.isFinite(value) && value >= 0) ||
      geometry.margins.left + geometry.margins.right >= geometry.width ||
      geometry.margins.top + geometry.margins.bottom >= geometry.height || !data.html)
    throw Error("Invalid section layout result");

  const range = (from: number, to = from) => {
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < from || to > data.sourceSize)
      throw Error(`Layout effect ${from}..${to} is outside source 0..${data.sourceSize}`);
  };
  const locator = (source: SectionSourceLocator) => {
    if (source.chapterId !== identity.sectionId || source.sourceRevision !== identity.sourceHash)
      throw Error(`Section source locator does not belong to its frozen revision: ${source.chapterId} ${source.from}..${source.to}`);
    range(source.from, source.to);
  };
  const location = (point: { page: number; x: number; y: number }) => {
    if (!Number.isInteger(point.page) || point.page < 1 || point.page > data.pages ||
        ![point.x, point.y].every(value => Number.isFinite(value) && value >= 0) ||
        point.x > geometry.width || point.y > geometry.height)
      throw Error(`Section target or link is outside its recorded page: page ${point.page}/${data.pages}, x=${point.x}, y=${point.y}`);
  };
  for (const source of data.sources) locator(source);
  for (const issue of data.issues ?? []) if (issue.source) locator(issue.source);

  const anchorIds = new Set<string>();
  for (const item of effects.anchors ?? []) {
    range(item.from, item.to);
    if (item.to <= item.from || !item.id || anchorIds.has(item.id))
      throw Error(`Invalid derived source anchor: ${item.id} at ${item.from}..${item.to}`);
    anchorIds.add(item.id);
  }
  for (const item of effects.breaks) {
    range(item.from, item.to);
    if (!Number.isFinite(item.height) ||
        (item.kind === "line" && item.height <= 0) ||
        (item.kind === "block" && (item.to === undefined || item.to <= item.from)) ||
        (item.marginTop !== undefined && !Number.isFinite(item.marginTop)))
      throw Error(`Invalid calibrated page break effect at ${item.from}..${item.to}: height=${item.height}, margin=${item.marginTop}`);
  }
  for (const item of effects.rows ?? []) {
    range(item.from, item.to);
    if (item.to <= item.from || !Number.isFinite(item.height) || item.height < 0)
      throw Error(`Invalid table row effect at ${item.from}..${item.to}: height=${item.height}`);
  }
  for (const item of effects.scales ?? []) {
    range(item.from, item.to);
    if (item.to <= item.from || !Number.isFinite(item.scale) || item.scale <= 0 || item.scale > 1)
      throw Error(`Invalid content scale effect at ${item.from}..${item.to}: scale=${item.scale}`);
  }
  for (const item of effects.furniture ?? []) {
    if (![item.top, item.left, item.width].every(Number.isFinite) || item.width <= 0 || !item.html)
      throw Error(`Invalid table furniture effect: top=${item.top}, left=${item.left}, width=${item.width}`);
  }
  if (data.composition && (!data.composition.html || !data.composition.bodySelector))
    throw Error("Invalid composition definition");
  const slots = new Set<string>();
  for (const item of effects.generated ?? []) {
    const key = JSON.stringify([item.slot, item.offset ?? null]);
    if (!data.composition || !item.slot || slots.has(key) ||
        ![item.height, item.marginTop].every(Number.isFinite) ||
        (item.offset !== undefined && (!Number.isInteger(item.offset) || item.offset < 0 || item.height <= 0)))
      throw Error(`Invalid generated slot effect: ${item.slot}, offset=${item.offset}, height=${item.height}`);
    slots.add(key);
  }

  const ids = new Set<string>();
  const targets = data.targets.filter(target => {
    if (ids.has(target.id)) return false;
    location(target);
    locator(target.source);
    if (!target.id) throw Error("Empty section target");
    ids.add(target.id);
    return true;
  });
  const crossSectionTargets = data.crossSectionTargets.filter(target => {
    if (ids.has(target.id)) return false;
    if (!target.id || target.chapterId === identity.sectionId ||
        !target.chapterId.startsWith(`${identity.documentId}.`) ||
        target.chapterId.length <= identity.documentId.length + 1)
      throw Error(`Invalid cross-section source target: ${target.id}`);
    ids.add(target.id);
    return true;
  });
  for (const link of data.links) {
    location(link);
    locator(link.source);
    if (![link.width, link.height].every(value => Number.isFinite(value) && value > 0) ||
        link.x + link.width > geometry.width || link.y + link.height > geometry.height || !ids.has(link.target))
      throw Error(`Section link does not have a valid recorded destination or rectangle: ${link.target}, page ${link.page}, x=${link.x}, y=${link.y}, width=${link.width}, height=${link.height}`);
  }

  // Decisions and movement traces explain layout; they do not decide whether it can be published.
  const published = {
    ...data,
    targets,
    crossSectionTargets,
    effects: {
      ...effects,
      anchors: effects.anchors ?? [],
      rows: effects.rows ?? [],
      scales: effects.scales ?? [],
      furniture: effects.furniture ?? [],
      generated: effects.generated ?? [],
    },
    issues: data.issues ?? [],
  };
  freezeLayoutData(published);
  publishedLayouts.add(published);
  return published;
}

/** The publication DTO contains only plain data, owned by its structured clone. */
function freezeLayoutData(value: unknown): void {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return;
  for (const child of Object.values(value)) freezeLayoutData(child);
  Object.freeze(value);
}
