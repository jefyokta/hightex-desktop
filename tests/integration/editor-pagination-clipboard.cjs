const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { PDFDocument } = require("pdf-lib");

async function setup({ execute, until }) {
  await execute(`
    window.clip={};
    clip.source={type:'doc',content:[editor.getJSON().content[0],
      {type:'paragraph',attrs:{id:'clip-long'},content:[{type:'text',text:sentence.repeat(38),marks:[{type:'bold'},{type:'italic'}]}]},
      {...makeTable(3),attrs:{id:'clip-table',figureId:'clip-table-figure'}},
      {type:'blockMath',attrs:{id:'clip-equation',latex:'x^2+1'}},
      {type:'paragraph',attrs:{id:'clip-reference'},content:[{type:'text',text:'Equation target: '},{type:'refComponent',attrs:{ref:'equation',link:'clip-equation',label:'Equation proof'}}]},
      {type:'paragraph',attrs:{id:'clip-end'},content:[{type:'text',text:'CLIPBOARD-END'}]},
    ]};
    clip.install=async()=>{
      setPages(false);await prepareComparison(clip.source);editor.commands.setContent(clip.source);
      await waitSaved();await prepareComparison(editor.getJSON());setPages(true);
    };
    clip.transfer=(type,data=new DataTransfer())=>{
      const event=new ClipboardEvent(type,{clipboardData:data,bubbles:true,cancelable:true});
      editor.view.dom.dispatchEvent(event);
      if(!event.defaultPrevented)throw Error('Editor did not handle '+type);
      return data;
    };
    clip.find=(type,id)=>{let result;editor.state.doc.descendants((node,pos)=>{if(node.type.name===type&&(!id||node.attrs.id===id))result={node,pos}});return result};
    clip.saved=async()=>JSON.stringify((await db.chapters.get('fixture.1')).content)===JSON.stringify(editor.getJSON().content);
    await clip.install();await document.fonts.ready;
  `);
  await stable({ until });
}
async function stable({ until }) {
  await until(
    "layoutReady()&&!layout().error&&!document.querySelector('[data-pagination-measure]')",
  );
}

async function crossing(context) {
  const { execute } = context;
  const result = await execute(`
    const cut=layout().breaks.find(item=>item.kind==='line');if(!cut)throw Error('Fixture has no inline page break');
    const from=cut.from-25,to=cut.from+25,original=editor.state.doc,updatesBefore=updates;
    editor.commands.setTextSelection({from,to});editor.view.focus();
    const selected=original.textBetween(from,to,'\\n\\n'),selection=JSON.stringify(editor.state.selection.toJSON());
    const data=clip.transfer('copy');
    const copy={text:data.getData('text/plain')===selected,noWidgets:!/data-editor-page-break|editor-pagination|\\u2060/.test(data.getData('text/html')),
      source:editor.state.doc.eq(original),selection:selection===JSON.stringify(editor.state.selection.toJSON()),noAutosave:updates===updatesBefore,
      bold:data.getData('text/html').includes('<strong>'),italic:data.getData('text/html').includes('<em>')};
    closeHistory();clip.transfer('cut');closeHistory();await waitSaved();
    // Model positions, not DOM text offsets, define the deletion.
    const cutValid=editor.state.doc.eq(nativeEditor.EditorState.create({doc:original}).tr.delete(from,to).doc);
    const storedCut=await clip.saved();clip.transfer('paste',data);closeHistory();await waitSaved();
    const restored=editor.state.doc.eq(original),storedPaste=await clip.saved();
    editor.commands.undo();const undoPaste=editor.state.doc.eq(nativeEditor.EditorState.create({doc:original}).tr.delete(from,to).doc);
    editor.commands.undo();const undoCut=editor.state.doc.eq(original);await waitSaved();
    return {pages:layout().pages,copy,cutValid,storedCut,restored,storedPaste,undoPaste,undoCut};
  `);
  await stable(context);
  return result;
}

async function copyIdentity(context) {
  const { execute } = context;
  await execute("await clip.install()");
  await stable(context);
  const result = await execute(`
    const original=clip.find('figureTable','clip-table');editor.commands.setNodeSelection(original.pos);
    const data=clip.transfer('copy');
    editor.commands.setTextSelection(editor.state.doc.child(0).nodeSize+1);clip.transfer('paste',data);await waitSaved();
    const tables=[];editor.state.doc.descendants((node,pos)=>{if(node.type.name==='figureTable')tables.push({id:node.attrs.id,pos})});
    const ids=[];editor.state.doc.descendants(node=>{if(node.attrs.id&&node.attrs.shouldUnique!==false)ids.push(node.attrs.id)});
    return {tables,idsUnique:new Set(ids).size===ids.length,originalKept:tables.at(-1)?.id==='clip-table',copyNewID:tables[0]?.id!=='clip-table',stored:await clip.saved()};
  `);
  await stable(context);
  return result;
}

async function copyReference(context) {
  const { execute } = context;
  await execute("await clip.install()");
  await stable(context);
  const result = await execute(`
    const reference=clip.find('paragraph','clip-reference');editor.commands.setNodeSelection(reference.pos);
    const data=clip.transfer('copy');editor.commands.setTextSelection(editor.state.doc.content.size-1);clip.transfer('paste',data);await waitSaved();
    const refs=[];editor.state.doc.descendants(node=>{if(node.type.name==='refComponent')refs.push({ref:node.attrs.ref,link:node.attrs.link,label:node.attrs.label})});
    return {refs,retained:refs.length===2&&refs.every(ref=>ref.ref==='equation'&&ref.link==='clip-equation'&&ref.label==='Equation proof'),stored:await clip.saved()};
  `);
  await stable(context);
  return result;
}

async function cutMove(context) {
  const { execute } = context;
  await execute("await clip.install()");
  await stable(context);
  const result = await execute(`
    const original=editor.state.doc,target=clip.find('figureTable','clip-table');
    editor.commands.setNodeSelection(target.pos);closeHistory();const data=clip.transfer('cut');closeHistory();await waitSaved();
    const removed=!clip.find('figureTable','clip-table');
    editor.commands.setTextSelection(editor.state.doc.content.size-1);clip.transfer('paste',data);closeHistory();await waitSaved();
    const moved=clip.find('figureTable','clip-table'),preserved=Boolean(moved)&&moved.pos>target.pos,stored=await clip.saved();
    editor.commands.undo();editor.commands.undo();await waitSaved();
    return {removed,preserved,stored,undo:editor.state.doc.eq(original)};
  `);
  await stable(context);
  return result;
}

async function plainReference(context) {
  const { execute } = context;
  await execute("await clip.install()");
  await stable(context);
  const result = await execute(`
    editor.commands.setTextSelection(editor.state.doc.content.size-1);
    const data=new DataTransfer();data.setData('text/plain','@equation[clip-equation]');clip.transfer('paste',data);await waitSaved();
    const refs=[];editor.state.doc.descendants(node=>{if(node.type.name==='refComponent')refs.push({kind:node.attrs.ref,target:node.attrs.link})});
    return {converted:refs.length===2&&refs.every(ref=>ref.kind==='equation'&&ref.target==='clip-equation'),stored:await clip.saved()};
  `);
  await stable(context);
  return result;
}

async function exportClipboard({ execute, editorPDFTest }) {
  const capture = await execute(`
    const {captureDocumentPDF}=await import('/src/document-export/capture.ts');
    const before=JSON.stringify(editor.getJSON()),task=new AbortController();
    const timer=setTimeout(()=>task.abort(new Error('Clipboard capture deadline')),25000);
    try{
      clip.snapshot=await captureDocumentPDF(editor,task.signal);
      const parsed=new DOMParser().parseFromString(clip.snapshot.html,'text/html');
      const ids=Array.from(parsed.querySelectorAll('[id]'),node=>node.id);
      const links=Array.from(parsed.querySelectorAll('a[href^="#"]'),node=>decodeURIComponent(node.getAttribute('href').slice(1)));
      return {pages:clip.snapshot.pages,unique:new Set(ids).size===ids.length,linked:links.every(id=>ids.includes(id)),
        sourceUnchanged:before===JSON.stringify(editor.getJSON())};
    }finally{clearTimeout(timer)}
  `);
  assert.equal(capture.unique, true);
  assert.equal(capture.linked, true);
  assert.equal(capture.sourceUnchanged, true);
  await execute(
    "await window.editorPDFExperimental.export(clip.snapshot,crypto.randomUUID())",
  );
  const file = editorPDFTest.outputs.at(-1),
    pdf = await PDFDocument.load(fs.readFileSync(file));
  assert.equal(pdf.getPageCount(), capture.pages);
  const text = execFileSync("pdftotext", ["-raw", file, "-"], {
    encoding: "utf8",
  });
  assert.ok(!text.includes("Equation proof"), "Serialized reference label overrode recounted numbering");
  for (const expected of ["Persamaan 1", "CLIPBOARD-END"])
    assert.ok(text.includes(expected), "PDF missing " + expected);
  return { ...capture, file };
}
exports.prepareClipboard = setup;
exports.exportClipboard = exportClipboard;

exports.runClipboard = async (context) => {
  const { execute, artifacts } = context;
  const report = {
    clipboard:
      "Chromium ClipboardEvent/DataTransfer invokes real editor handlers; system clipboard untouched",
  };
  const save = () =>
    fs.writeFileSync(
      path.join(artifacts, "clipboard-regression.json"),
      JSON.stringify(report, null, 2),
    );
  try {
    await setup(context);
    report.crossing = await crossing(context);
    save();
    report.identity = await copyIdentity(context);
    save();
    report.reference = await copyReference(context);
    save();
    report.cutMove = await cutMove(context);
    save();
    report.plainReference = await plainReference(context);
    save();
    for (const [key, value] of Object.entries(report.crossing.copy))
      assert.equal(value, true, "Copy " + key);
    for (const field of [
      "cutValid",
      "storedCut",
      "restored",
      "storedPaste",
      "undoPaste",
      "undoCut",
    ])
      assert.equal(report.crossing[field], true, field);
    assert.equal(report.identity.idsUnique, true);
    assert.equal(
      report.identity.originalKept,
      true,
      "Paste before source stole original ID",
    );
    assert.equal(report.identity.copyNewID, true);
    assert.equal(report.identity.stored, true);
    assert.equal(
      report.reference.retained,
      true,
      "Reference atom was lost or altered on paste",
    );
    assert.equal(report.reference.stored, true);
    for (const [field, value] of Object.entries(report.cutMove))
      assert.equal(value, true, "Cut/move " + field);
    for (const [field, value] of Object.entries(report.plainReference))
      assert.equal(value, true, "Plain reference " + field);
    if (context.print !== false) {
      report.pdf = await exportClipboard(context);
      fs.copyFileSync(report.pdf.file, path.join(artifacts, "clipboard-result.pdf"));
    }
    report.passed = true;
    save();
    console.log(
      "PASS: copy/cut/paste across a page break preserves formatted text and undo/autosave; pasted blocks keep original target ownership and unique IDs; reference atoms round-trip.",
    );
    console.log("Clipboard evidence:", artifacts);
  } catch (error) {
    report.failure = { message: error.message, stack: error.stack };
    save();
    throw error;
  } finally {
    await execute("if(window.clip)await waitSaved()").catch(() => {});
  }
};
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  process.env.HIGHTEX_EDITOR_PDF_PIPELINE = "1";
  process.env.HIGHTEX_EDITOR_CLIPBOARD = "1";
  require("./editor-pagination.cjs");
}
