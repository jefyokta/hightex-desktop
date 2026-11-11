// Isolated React editor and real chapter graphs; no user documents or backend.
// env -u ELECTRON_RUN_AS_NODE node_modules/.bin/electron tests/integration/equation-numbering.cjs
const { app, BrowserWindow } = require("electron");
const { createServer } = require("node:http");
const { mkdtempSync } = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../..");
const profile = mkdtempSync(path.join(os.tmpdir(), "hightex-equations-"));
app.setPath("userData", profile);
app.commandLine.appendSwitch("disable-gpu");
let vite, server, win;
const html = `<!doctype html><body><main id="root"></main><script type="module">
import React from 'react';
import {createRoot} from 'react-dom/client';
import {EditorContent,useEditor} from '@tiptap/react';
import {closeHistory} from '@tiptap/pm/history';
import {Document} from '/src/editor/document/index.ts';
import {events} from '/src/editor/event/index.ts';
import {Manager} from '/src/editor/manager/index.ts';
import {HighTexDB} from '/src/editor/storage/hightex-db.ts';
import {Storage} from '/src/editor/storage/index.ts';
window.config={get:()=>({language:'id'}),onChange:()=>()=>{}};
window.hightex={categories:async()=>[{id:1,name:'Fixture',variant:'thesis',chapters:[{chapter:'1',title:'First'},{chapter:'2',title:'Second'}]}]};
const db=HighTexDB.getInstance();await db.open();
const heading=title=>({type:'heading',attrs:{level:1},content:[{type:'text',text:title}]});
const equation=(id,latex='E=mc^2')=>({type:'blockMath',attrs:{id,latex}});
window.equation=equation;
await db.documents.put({id:'fixture',title:'Equations',category:'1',config:{},keywords:{indonesian:[],english:[]}});
await db.chapters.bulkPut([
 {id:'fixture.1',content:[heading('First'),equation('previous-equation')]},
 {id:'fixture.2',content:[heading('Second'),equation(null),{type:'paragraph'},equation('existing-equation','F=ma')]},
]);
const doc=await new Document('fixture').warm({workspaceIdentity:false});
const chapter=doc.chapters.find(chapter=>chapter.getChapter()==='2');
Document.setCurrentChapter(chapter);
window.doc=doc;window.chapter=chapter;window.Manager=Manager;window.Document=Document;
window.pending=new Set();window.saveDelay=80;
const persist=Storage.instance.setChapter.bind(Storage.instance);
Storage.instance.setChapter=async value=>{await new Promise(resolve=>setTimeout(resolve,window.saveDelay));return persist(value)};
window.zeroSeen=false;
const readNumbers=()=>Array.from(document.querySelectorAll('.node-blockMath button span.text-sm')).map(span=>span.textContent);
window.readNumbers=readNumbers;
new MutationObserver(()=>{if(readNumbers().includes('(0)'))window.zeroSeen=true}).observe(document.getElementById('root'),{childList:true,subtree:true,characterData:true});
function Fixture(){
 const editor=useEditor({extensions:chapter.extensions.get(),editable:false,content:'',
  onCreate:async({editor})=>{await events.create({editor,chapter});window.ready=true},
  onUpdate:({editor})=>{const write=events.update({editor});window.pending.add(write);write.finally(()=>window.pending.delete(write))},
 });
 window.editor=editor;
 return React.createElement(EditorContent,{editor});
}
window.closeHistory=()=>editor.view.dispatch(closeHistory(editor.state.tr));
window.swapEquations=()=>{
 const content=editor.getJSON().content;
 const equations=content.filter(node=>node.type==='blockMath').reverse();
 editor.commands.setContent({type:'doc',content:[content[0],...equations]});
};
createRoot(document.getElementById('root')).render(React.createElement(Fixture));
</script>`;
const execute = (code) => win.webContents.executeJavaScript(code);
async function until(code) {
  const deadline = Date.now() + 15000;
  while (!(await execute(code))) {
    if (Date.now() > deadline) {
      const state = await execute(
        "({numbers:readNumbers(),content:editor.getJSON(),graphs:doc.chapters.map(chapter=>({id:chapter.getId(),equations:chapter.graph.data.equations})),pending:pending.size})",
      );
      throw Error(`Timed out: ${code}\n${JSON.stringify(state)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
}
const numbers = async (expected) => {
  await until(
    `JSON.stringify(readNumbers())===${JSON.stringify(JSON.stringify(expected))}`,
  );
  assert.equal(
    await execute("window.zeroSeen"),
    false,
    "equation counter displayed zero",
  );
};
app
  .whenReady()
  .then(async () => {
    const { createServer: createVite } = await import("vite");
    vite = await createVite({
      configFile: false,
      root,
      cacheDir: path.join(profile, "vite"),
      resolve: { alias: { "@": path.join(root, "src") } },
      server: { middlewareMode: true, hmr: false },
      logLevel: "error",
    });
    server = createServer(async (req, res) => {
      if (req.url === "/") {
        res.setHeader("content-type", "text/html");
        res.end(await vite.transformIndexHtml("/", html));
      } else
        vite.middlewares(req, res, () => {
          res.statusCode = 404;
          res.end();
        });
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    win = new BrowserWindow({
      show: false,
      webPreferences: { backgroundThrottling: false },
    });
    win.webContents.on("console-message", (event) => {
      if (event.level === "error") console.error(event.message);
    });
    await win.loadURL("http://127.0.0.1:" + server.address().port + "/");
    await until("window.ready===true");
    await numbers(["(2)", "(3)"]);
    assert.ok(
      await execute(
        "editor.getJSON().content.filter(node=>node.type==='blockMath').every(node=>node.attrs.id)",
      ),
    );
    await until("pending.size===0");
    await execute(
      "closeHistory();editor.commands.insertContentAt(0,equation(null));void 0",
    );
    await numbers(["(2)", "(3)", "(4)"]);
    await until("pending.size===0");
    const firstPosition = await execute(
      "(()=>{let found;editor.state.doc.descendants((node,pos)=>{if(found===undefined&&node.type.name==='blockMath')found=pos});return found})()",
    );
    await execute(
      `closeHistory();editor.commands.deleteRange({from:${firstPosition},to:${firstPosition + 1}});void 0`,
    );
    await numbers(["(2)", "(3)"]);
    await until("pending.size===0");
    await execute("editor.commands.undo();void 0");
    await numbers(["(2)", "(3)", "(4)"]);
    await until("pending.size===0");
    await execute("editor.commands.redo();void 0");
    await numbers(["(2)", "(3)"]);
    await until("pending.size===0");
    await execute("swapEquations();void 0");
    await numbers(["(2)", "(3)"]);
    await until("pending.size===0");
    const referenced = await execute(
      "doc.getEquations().then(equations=>equations.filter(eq=>eq.chapterId==='fixture.2').map(eq=>({id:eq.id,pos:eq.pos})))",
    );
    const displayedIds = await execute(
      "editor.getJSON().content.filter(node=>node.type==='blockMath').map(node=>node.attrs.id)",
    );
    assert.deepEqual(
      referenced.map((eq) => eq.id),
      displayedIds,
    );
    assert.deepEqual(
      referenced.map((eq) => eq.pos),
      [2, 3],
    );
    // Let a newer graph read finish before an older snapshot. The late result
    // must not restore numbers from before an earlier chapter was changed.
    await execute(`window.graphReads=[];
    window.readEquations=doc.getEquations.bind(doc);
    doc.getEquations=async()=>{
      const snapshot=await readEquations();
      return new Promise(resolve=>graphReads.push({snapshot,resolve}));
    };
    Document.instance=new Document('unrelated');
    Manager.app.dispatch('chapter:update',{chapterId:chapter.getId(),chapter});
    void 0;`);
    await until("graphReads.length===2");
    await execute(`(async()=>{
    const previous=doc.chapters.find(chapter=>chapter.getChapter()==='1');
    await previous.setContent([...(await previous.getContent()),equation('another-previous-equation')]);
    return true;
  })()`);
    await until("graphReads.length===4");
    await execute(
      "graphReads.slice(2).forEach(read=>read.resolve(read.snapshot));void 0",
    );
    await numbers(["(3)", "(4)"]);
    await execute(
      "graphReads.slice(0,2).forEach(read=>read.resolve(read.snapshot));void 0",
    );
    await execute(
      "new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))",
    );
    assert.deepEqual(await execute("readNumbers()"), ["(3)", "(4)"]);
    await execute("doc.getEquations=readEquations;void 0");
    assert.equal(await execute("zeroSeen"), false);
    console.log(
      "PASS: graph numbering after loading a missing ID, delayed saves, insertion, deletion, undo, redo and reorder; no zero; references match; stale reads and another document cannot overwrite numbering.",
    );
    win.destroy();
    server.close();
    await vite.close();
    app.exit(0);
  })
  .catch(async (error) => {
    console.error(error);
    win?.destroy();
    server?.close();
    await vite?.close();
    app.exit(1);
  });
