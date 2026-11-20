const assert = require("node:assert/strict");

// Serialized into both renderer windows. Live page assignment comes from actual
// DOM placement; the print surface supplies its physical document page number.
function measureContent(surfaces, geometry) {
  const glyphs = [],
    words = [],
    images = [],
    labels = [],
    runs = [];
  for (const { root, paper, page: fixedPage } of surfaces) {
    const doc = root.ownerDocument,
      origin = paper.getBoundingClientRect(),
      scale = geometry ? origin.width / geometry.width : 1;
    const placed = (box) => {
      const top = (box.top - origin.top) / scale,
        index = geometry ? Math.floor(top / geometry.stride) : 0;
      return {
        page: fixedPage ?? index + 1,
        x: (box.left - origin.left) / scale,
        y: top - (geometry ? index * geometry.stride : 0),
        width: box.width / scale,
        height: box.height / scale,
      };
    };
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (
        parent.closest(
          ".katex-mathml,[data-editor-ui],[data-editor-page-break],script,style,.editor-pagination-number",
        )
      )
        continue;
      if (
        parent.closest("button") &&
        !parent.closest(".katex-html,[data-equation-number]")
      )
        continue;
      const style = doc.defaultView.getComputedStyle(parent),
        range = doc.createRange();
      let offset = 0,
        run;
      for (const character of node.textContent) {
        if (character.trim() && character !== "\u2060") {
          range.setStart(node, offset);
          range.setEnd(node, offset + character.length);
          const box = range.getBoundingClientRect();
          if (box.width && box.height) {
            const position = placed(box);
            glyphs.push({
              character,
              paintedCharacter: style.textTransform === "uppercase" ? character.toLocaleUpperCase() :
                style.textTransform === "lowercase" ? character.toLocaleLowerCase() : character,
              ...position,
              font: [
                style.fontFamily,
                style.fontSize,
                style.fontWeight,
                style.fontStyle,
                style.letterSpacing,
              ].join("|"),
            });
            if (
              !run ||
              run.page !== position.page ||
              Math.abs(run.y - position.y) > 0.25
            ) {
              run = { page: position.page, y: position.y, text: "" };
              runs.push(run);
            }
            run.text += character;
          }
        }
        offset += character.length;
      }
      for (const match of node.textContent.matchAll(/EQ[A-Z]\d{3}/g)) {
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        const box = range.getBoundingClientRect();
        if (box.width && box.height)
          words.push({ text: match[0], ...placed(box) });
      }
    }
    for (const image of root.querySelectorAll(
      "img:not(.ProseMirror-separator)",
    )) {
      const box = image.getBoundingClientRect();
      if (box.width && box.height) images.push(placed(box));
    }
    for (const label of root.querySelectorAll("[data-label]")) {
      const style = doc.defaultView.getComputedStyle(label, "::before");
      if (style.content !== "none")
        labels.push({
          label: label.dataset.label,
          before: style.content,
          font: [
            style.fontFamily,
            style.fontSize,
            style.fontWeight,
            style.fontStyle,
          ].join("|"),
        });
    }
  }
  return { glyphs, words, images, labels, runs };
}
exports.measureContent = measureContent;

// One canonical context per editable section in the version-3 print host.
function measureProjectedSection(snapshot, sectionId, measure) {
  const section=snapshot.sections.find(item=>item.id===sectionId);
  const view=snapshot.projection.views[section.firstPage-1],geometry=snapshot.projection.contexts[view.context];
  const paper=document.querySelector('[data-print-context="'+view.context+'"] [data-section-context]');
  return measure([{root:paper.querySelector('.tiptap'),paper},
    ...Array.from(paper.querySelectorAll('.editor-pagination-furniture'),root=>({root,paper}))],geometry);
}
exports.measureProjectedSection=measureProjectedSection;

// Serialized into editor and native print host; includes merged/nested/repeated grids.
function measureTableContent(paper, geometry) {
  const origin=paper.getBoundingClientRect(),scale=origin.width/geometry.width,cells=[],rules=[];
  const boxOf=node=>{const box=node.getBoundingClientRect();return {x:(box.left-origin.left)/scale,
    y:(box.top-origin.top)/scale,width:box.width/scale,height:box.height/scale}};
  const borders=node=>{
    const style=getComputedStyle(node);
    return ['Top','Right','Bottom','Left'].map(side=>{
      const width=style['border'+side+'Width'],line=style['border'+side+'Style'];
      return [side,width,line,parseFloat(width)>0&&line!=='none'?style['border'+side+'Color']:null];
    });
  };
  for(const node of paper.querySelectorAll('table,tr,td,th,col')){
    const box=boxOf(node),edges=borders(node);
    cells.push({tag:node.tagName,rowspan:node.rowSpan??1,colspan:node.colSpan??1,...box,
      ink:getComputedStyle(node).color,borders:edges});
    for(const [side,width,style,color]of edges){
      if(parseFloat(width)<=0||style!=='solid'||color!=='rgb(0, 0, 0)')continue;
      const horizontal=side==='Top'||side==='Bottom';
      const x=box.x+(side==='Right'?box.width:0),y=box.y+(side==='Bottom'?box.height:0);
      if(horizontal){
        const page=Math.floor(y/geometry.stride)+1;
        let segments=[{x,width:box.width}];
        // Collapsed row borders do not cross the interior of a spanning cell.
        // Computed row style alone describes a full edge that Chromium never paints.
        if(node.tagName==='TR'&&getComputedStyle(node.closest('table')).borderCollapse==='collapse'){
          for(const row of node.closest('table').rows)for(const cell of row.cells){
            if(cell.rowSpan===1)continue;
            const span=boxOf(cell);
            if(y<=span.y+.75||y>=span.y+span.height-.75)continue;
            segments=segments.flatMap(segment=>{
              const end=segment.x+segment.width,spanEnd=span.x+span.width;
              if(spanEnd<=segment.x||span.x>=end)return [segment];
              const remaining=[];
              if(span.x>segment.x)remaining.push({x:segment.x,width:span.x-segment.x});
              if(spanEnd<end)remaining.push({x:spanEnd,width:end-spanEnd});
              return remaining;
            });
          }
        }
        for(const segment of segments)rules.push({page,...segment,y:y-(page-1)*geometry.stride,height:0});
      }
      else for(let page=Math.floor(y/geometry.stride)+1;page<=Math.floor((y+box.height)/geometry.stride)+1;page++){
        const top=Math.max(y,(page-1)*geometry.stride+geometry.margins.top),bottom=Math.min(y+box.height,(page-1)*geometry.stride+geometry.height-geometry.margins.bottom);
        if(bottom>top)rules.push({page,x,y:top-(page-1)*geometry.stride,width:0,height:bottom-top});
      }
    }
  }
  return {cells,rules};
}
exports.measureTableContent=measureTableContent;

exports.compareTableContent=(expected,actual,tolerance=.75)=>{
  assert.equal(actual.cells.length,expected.cells.length,'Table grid count changed');
  let maxDifference=0;
  expected.cells.forEach((cell,index)=>{
    const other=actual.cells[index];
    for(const field of ['tag','rowspan','colspan','borders','ink'])assert.deepEqual(other[field],cell[field],'Table cell '+index+' '+field);
    for(const field of ['x','y','width','height']){
      const delta=Math.abs(other[field]-cell[field]);maxDifference=Math.max(maxDifference,delta);
      assert.ok(delta<=tolerance,'Table cell '+index+' '+field+' moved '+delta+'px');
    }
  });
  return {cells:actual.cells.length,maxDifference,tolerancePixels:tolerance};
};

// Match by character/page and position, consuming each glyph once. Text alone
// would miss moved/repeated characters or a different line wrap.
exports.compareContent = (expected, actual, tolerance = 0.75) => {
  assert.equal(
    actual.glyphs.length,
    expected.glyphs.length,
    "Visible glyph count changed",
  );
  const buckets = new Map();
  const key = (glyph, x, y) => [glyph.page, glyph.character, x, y].join("|");
  for (const glyph of actual.glyphs) {
    const k = key(glyph, Math.floor(glyph.x / 4), Math.floor(glyph.y / 4));
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(glyph);
  }
  let maxDifference = 0;
  for (const glyph of expected.glyphs) {
    let found;
    for (let dx = -1; dx <= 1 && !found; dx++)
      for (let dy = -1; dy <= 1 && !found; dy++) {
        const list =
          buckets.get(
            key(
              glyph,
              Math.floor(glyph.x / 4) + dx,
              Math.floor(glyph.y / 4) + dy,
            ),
          ) ?? [];
        const index = list.findIndex(
          (candidate) =>
            ["x", "y", "width", "height"].every(
              (field) => Math.abs(candidate[field] - glyph[field]) <= tolerance,
            ) && candidate.font === glyph.font,
        );
        if (index >= 0) {
          found = list.splice(index, 1)[0];
          maxDifference = Math.max(
            maxDifference,
            ...["x", "y", "width", "height"].map((field) =>
              Math.abs(found[field] - glyph[field]),
            ),
          );
        }
      }
    assert.ok(
      found,
      "Editor glyph differs from print: " + JSON.stringify(glyph),
    );
  }
  assert.equal(
    actual.images.length,
    expected.images.length,
    "Image count changed",
  );
  for (const [index, image] of expected.images.entries())
    for (const field of ["page", "x", "y", "width", "height"])
      assert.ok(
        Math.abs(image[field] - actual.images[index][field]) <=
          (field === "page" ? 0 : tolerance),
        "Image " + field + " changed",
      );
  const sorted = (labels) =>
    [...labels].sort((a, b) =>
      JSON.stringify(a).localeCompare(JSON.stringify(b)),
    );
  assert.deepEqual(
    sorted(actual.labels),
    sorted(expected.labels),
    "Generated labels or their styles changed",
  );
  return {
    glyphs: actual.glyphs.length,
    images: actual.images.length,
    labels: actual.labels.length,
    maxDifference,
    tolerancePixels: tolerance,
  };
};
