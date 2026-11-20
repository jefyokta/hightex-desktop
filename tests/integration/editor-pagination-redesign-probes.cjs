// Browser probes for the replacement design's acceptance inventory, not fixes.
exports.schemaInventory = async function () {
  const { getSchema } = window.nativeEditor;
  const { ChapterExtensions } = await import('/src/editor/chapter/chapter-extensions.ts');
  const inventory = {};
  for (const chapter of ['1', 'abstract', 'abstract-en', 'foreword', 'attachment']) {
    const schema = getSchema(ChapterExtensions.contentSchema(chapter));
    inventory[chapter] = {
      nodes: Object.values(schema.nodes).map(node => ({
        name: node.name, content: node.spec.content ?? '', group: node.spec.group ?? '',
        inline: node.isInline, atom: node.isAtom,
        attributes: Object.keys(node.spec.attrs ?? {}),
      })),
      marks: Object.values(schema.marks).map(mark => ({
        name: mark.name, attributes: Object.keys(mark.spec.attrs ?? {}),
      })),
    };
  }
  return inventory;
};

exports.installImageAudit = async function () {
  const { PageFragments } = await import('/tests/helpers/legacy-pagination/fragments.ts');
  const original = PageFragments.prototype.render;
  window.redesignImageAudit = [];
  PageFragments.prototype.render = async function (...args) {
    const { source, view, layout } = this.chapter;
    window.redesignImageAudit.push(window.redesignAuditView(source, view, layout, this.geometry));
    return original.apply(this, args);
  };
};

exports.auditView = function (source, view, layout, geometry) {
    const paper = view.dom.closest('.page').getBoundingClientRect();
    const images = [];
    source.descendants((node, position) => {
      if (node.type.name !== 'image') return;
      const dom = view.nodeDOM(position);
      const image = dom instanceof HTMLImageElement ? dom : dom?.querySelector('img');
      const parent = source.resolve(position);
      const ancestry = Array.from({ length: parent.depth }, (_, i) => ({
        type: parent.node(i + 1).type.name, attrs: parent.node(i + 1).attrs,
        from: parent.before(i + 1),
      }));
      const bounds = image?.getBoundingClientRect();
      const page = bounds ? Math.floor((bounds.top - paper.top) / geometry.stride) : -1;
      const top = paper.top + page * geometry.stride + geometry.margins.top;
      const bottom = top + geometry.contentHeight;
      images.push({
        ordinal: images.length + 1, position, to: position + node.nodeSize,
        attributes: node.attrs, ancestry, natural: [image?.naturalWidth, image?.naturalHeight],
        presentation: image ? { style: image.getAttribute('style'), widthAttribute: image.getAttribute('width'), computedWidth: getComputedStyle(image).width, maxWidth: getComputedStyle(image).maxWidth } : null,
        page: page + 1,
        bounds: bounds ? { left: bounds.left - paper.left, top: bounds.top - paper.top, width: bounds.width, height: bounds.height, bottom: bounds.bottom - paper.top } : null,
        content: { top: top - paper.top, bottom: bottom - paper.top },
        overflow: bounds ? { top: Math.max(0, top - bounds.top), bottom: Math.max(0, bounds.bottom - bottom), left: Math.max(0, paper.left + geometry.margins.left - bounds.left), right: Math.max(0, bounds.right - paper.right + geometry.margins.right) } : null,
      });
    });
    return { heading: source.firstChild?.textContent, source: source.toJSON(), layout, images };
};

exports.hardBreakBrowserProbe = function () {
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:-10000px;width:360px;font:16px "Times New Roman";text-align:justify';
  const results = [];
  document.body.append(host);
  try {
    for (const mode of ['auto', 'justify']) {
      host.style.textAlignLast = mode;
      host.innerHTML = '<ol><li><p>Kalimat pendek sebelum pindah baris<br>Kalimat lanjutan yang cukup panjang untuk membentuk beberapa baris otomatis dalam paragraf yang sama. ' + 'Lanjutan isi paragraf. '.repeat(12) + '</p></li></ol>';
      const paragraph = host.querySelector('p');
      const range = document.createRange();
      range.selectNodeContents(paragraph.firstChild);
      results.push({ mode, beforeBRWidth: range.getBoundingClientRect().width, paragraphWidth: paragraph.getBoundingClientRect().width, source: paragraph.innerHTML });
    }
    return results;
  } finally {
    host.remove();
  }
};
