const assert = require("node:assert/strict");
const path = require("node:path");

exports.runWhitespace = async ({ execute }) => {
  const result = await execute(`
    const Schema=editor.schema.constructor;
    const {EditorState,EditorView}=nativeEditor;
    const {LayoutSnapshot}=await import('/src/editor/pagination/measurement/layout-snapshot.ts');
    const {measureEditor}=await import('/src/editor/pagination/measurement/measure-chapter.ts');
    const {FlowCache}=await import('/src/editor/pagination/flow/text-flow.ts');
    const {paginationDecorations,paginationFurniture}=await import('/src/editor/pagination/presentation/decorations.ts');
    const {PageFragments}=await import('/tests/helpers/legacy-pagination/fragments.ts');
    const {paginationGeometry,applyPageGeometry}=await import('/src/editor/pagination/options.ts');
    const {freezeReadOnlyPresentation}=await import('/src/editor/pagination/presentation/read-only-content.ts');
    const schema=new Schema({nodes:{
      doc:{content:'paragraph+'},text:{group:'inline'},
      paragraph:{content:'inline*',attrs:{id:{default:null}},toDOM:node=>['p',{id:node.attrs.id},0]},
      cite:{group:'inline',inline:true,atom:true,toDOM:()=>['cite',{contenteditable:'false'},'Nama       Penulis       (2026)']},
    }});
    const source=schema.node('doc',null,[
      schema.node('paragraph',{id:'wrap-short'},[schema.text('Teks pengantar '.repeat(6)),schema.node('cite')]),
      schema.node('paragraph',{id:'wrap-long'},[schema.text('Teks panjang '.repeat(500)),schema.node('cite')]),
    ]);
    const geometry=paginationGeometry(),paper=document.createElement('div'),output=document.createElement('div');
    paper.className='page ch';paper.dataset.paginationSurface='';
    paper.style.cssText='position:absolute;left:2400px;top:0';applyPageGeometry(paper,geometry);
    const wrapper=document.createElement('div');paper.append(wrapper);document.body.append(paper,output);
    const view=new EditorView(wrapper,{state:EditorState.create({doc:source}),editable:()=>false,attributes:{class:'tiptap','data-editor-pagination':'true'}});
    const before=source.toJSON(),task=new AbortController(),timer=setTimeout(()=>task.abort(new Error('Whitespace verification deadline')),15000);
    let snapshot,fragments;
    try{
      await document.fonts.ready;
      const live=Array.from(view.dom.querySelectorAll('p'),node=>node.getBoundingClientRect().height);
      snapshot=new LayoutSnapshot(view,geometry);
      const measured=Array.from(snapshot.root.querySelectorAll('p'),node=>node.getBoundingClientRect().height);
      const measuredAtomStyle=getComputedStyle(snapshot.root.querySelector('cite')).whiteSpace;
      const measurementReadOnly=!snapshot.root.querySelector('[contenteditable]')&&!snapshot.root.hasAttribute('contenteditable')&&snapshot.root.inert;
      snapshot.destroy();snapshot=undefined;
      const layout=await measureEditor(view,new FlowCache(),task.signal,geometry);
      view.setProps({decorations:()=>paginationDecorations(source,layout)});
      const chapter={source,view,layout,layoutRevision:1,headingNumbers:new Map()};
      fragments=new PageFragments(chapter,geometry);await fragments.render(output,task.signal,false);
      const sourceAtomStyle=getComputedStyle(view.dom.querySelector('cite')).whiteSpace;
      const fragmentAtomStyles=Array.from(output.querySelectorAll('cite'),node=>getComputedStyle(node).whiteSpace);
      const ids=Array.from(output.querySelectorAll('[id]'),node=>node.id);
      const nested=document.createElement('div');nested.className='ProseMirror';nested.contentEditable='true';
      nested.innerHTML='<span contenteditable="false">Outer <span contenteditable="true">Inner text</span></span>';
      document.body.append(nested);
      const elements=[nested,...nested.querySelectorAll('[contenteditable]')];
      const nestedBefore=elements.map(node=>getComputedStyle(node).whiteSpace);
      freezeReadOnlyPresentation(nested);
      const nestedAfter=elements.map(node=>getComputedStyle(node).whiteSpace);
      const nestedReadOnly=nested.inert&&!nested.querySelector('[contenteditable]')&&!nested.hasAttribute('contenteditable');nested.remove();
      const furniture=paginationFurniture([{top:0,left:0,width:100,html:'<figure><table><tbody><tr><th>Header<cite>Penulis (2026)</cite><img class="ProseMirror-separator"><span data-editor-page-break></span><img data-image-id="authored" src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22/%3E"></th></tr></tbody></table></figure>'}]);
      const furnitureClean=!furniture.querySelector('img.ProseMirror-separator,[data-editor-page-break]');
      const furnitureAuthored=furniture.querySelectorAll('img').length===1&&furniture.querySelector('cite').textContent==='Penulis (2026)';
      return {live,measured,measuredAtomStyle,sourceAtomStyle,fragmentAtomStyles,measurementReadOnly,
        fragmentReadOnly:!output.querySelector('[contenteditable]'),pages:fragments.pages.length,ids,
        nestedBefore,nestedAfter,nestedReadOnly,furnitureClean,furnitureAuthored,sourceUnchanged:JSON.stringify(source.toJSON())===JSON.stringify(before)};
    }finally{clearTimeout(timer);snapshot?.destroy();fragments?.destroy();view.destroy();paper.remove();output.remove()}
  `);
  console.log("Whitespace metrics:", JSON.stringify(result));
  assert.deepEqual(
    result.measured,
    result.live,
    "Removing editing attributes changed measured paragraph height",
  );
  assert.equal(result.measuredAtomStyle, result.sourceAtomStyle);
  assert.ok(
    result.fragmentAtomStyles.length >= 2,
    "Expected atoms in both complete and split paragraphs",
  );
  assert.ok(
    result.fragmentAtomStyles.every(
      (style) => style === result.sourceAtomStyle,
    ),
  );
  assert.ok(
    result.pages > 1,
    "Long paragraph must exercise partial range cloning",
  );
  assert.equal(new Set(result.ids).size, result.ids.length);
  assert.deepEqual(
    result.nestedAfter,
    result.nestedBefore,
    "Nested editing boundaries changed inherited wrapping",
  );
  for (const key of [
    "measurementReadOnly",
    "fragmentReadOnly",
    "nestedReadOnly",
    "furnitureClean",
    "furnitureAuthored",
    "sourceUnchanged",
  ])
    assert.equal(result[key], true, key);
  console.log(
    "PASS: measurement and complete/split PDF fragments preserve inline wrapping; nested editing boundaries retain their styles; output is inert, editing attributes are removed, anchors remain unique and source is unchanged.",
  );
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  process.env.HIGHTEX_EDITOR_WHITESPACE = "1";
  require("./editor-pagination.cjs");
}
