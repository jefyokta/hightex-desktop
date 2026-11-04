// Opt-in: env -u ELECTRON_RUN_AS_NODE electron tests/integration/table-pagination-stress.cjs
// Real compiler, Paged.js handlers, fonts and native PDF; isolated database, no server/accounts.
// Add --paragraphs for explained cases and sentence-level checks after the table.
// --all includes the original, paragraph and merged-header/oversized-row cases.
// --combinations covers multiple Tables, long captions, custom widths and Grid isolation.
const { app, BrowserWindow } = require("electron");
const { createServer } = require("node:http");
const { mkdtempSync, writeFileSync } = require("node:fs");
const { execFileSync } = require("node:child_process");
const path = require("node:path"),
  os = require("node:os");
const { PDFDocument } = require("pdf-lib");
const root = path.resolve(__dirname, "../..");
const artifacts = mkdtempSync(
  path.join(os.tmpdir(), "hightex-table-pagination-"),
);
app.setPath("userData", path.join(artifacts, "chrome"));
app.commandLine.appendSwitch("disable-gpu");
app.on("window-all-closed", () => {});
let win, server, vite;
const results = [];
const tableCases = [
  { id: "regular-160", rows: 160, preface: 3, mixed: false },
  { id: "near-break-112", rows: 112, preface: 14, mixed: false },
  { id: "mixed-height-96", rows: 96, preface: 3, mixed: true },
  {
    id: "saved-version-128",
    rows: 128,
    preface: 3,
    mixed: false,
    version: "v1",
  },
];
const paragraphCases = [
  {
    id: "closing-short-128",
    rows: 128,
    preface: 3,
    mixed: false,
    sentences: [3, 3, 3],
    explanation:
      "Tiga paragraf pendek sesudah tabel 128 baris. Periksa apakah awal, tengah, dan akhir setiap paragraf tercetak lengkap ketika ruang halaman hampir habis.",
  },
  {
    id: "closing-long-128",
    rows: 128,
    preface: 3,
    mixed: false,
    sentences: [24],
    explanation:
      "Satu paragraf panjang berisi 24 kalimat sesudah tabel 128 baris. Paragraf boleh terbelah ke halaman berikutnya, tetapi tidak boleh kehilangan kalimat atau potongan teks di batas halaman.",
  },
  {
    id: "closing-mixed-96",
    rows: 96,
    preface: 3,
    mixed: true,
    sentences: [8, 8, 8],
    explanation:
      "Tabel 96 baris dengan tinggi sel campuran, diikuti tiga paragraf berisi delapan kalimat. Periksa perpindahan dari baris terakhir ke paragraf dan kelanjutan paragraf di halaman berikutnya.",
  },
  {
    id: "closing-near-break-112",
    rows: 112,
    preface: 14,
    mixed: false,
    sentences: [6, 6, 6],
    explanation:
      "Empat belas paragraf pembuka mendorong awal tabel mendekati batas halaman. Tabel 112 baris diikuti tiga paragraf enam kalimat. Caption harus bersama isi tabel dan seluruh penutup harus tetap tercetak.",
  },
  {
    id: "closing-varied-125",
    rows: 125,
    preface: 3,
    mixed: false,
    sentences: [4, 12, 4],
    explanation:
      "Tabel 125 baris diikuti paragraf pendek, panjang, lalu pendek. Periksa khususnya akhir paragraf panjang serta awal paragraf terakhir; panjang yang berbeda menggeser titik pemisahan halaman.",
  },
  {
    id: "closing-version-128",
    rows: 128,
    preface: 3,
    mixed: false,
    sentences: [3, 3, 3],
    version: "v1",
    explanation:
      "Preview versi tersimpan v1 berisi tabel 128 baris dan tiga paragraf pendek. Draft sengaja berisi teks berbeda. Hasil harus berasal dari v1 dan seluruh kalimat penutup harus tercetak.",
  },
];
const edgeCases = [
  {
    id: "merged-header-96",
    rows: 96,
    preface: 3,
    mixed: true,
    mergedHeader: true,
    sentences: [8, 8, 8],
    explanation:
      "Header dua tingkat memakai colspan dan rowspan. Lebar tiga kolom harus konsisten pada semua halaman, header lengkap berulang, dan paragraf penutup utuh.",
  },
  {
    id: "oversized-row-48",
    rows: 48,
    preface: 3,
    mixed: false,
    longRow: 17,
    sentences: [3, 3, 3],
    explanation:
      "Baris 17 lebih tinggi daripada satu halaman. Baris ini boleh bersambung agar pagination tetap maju; baris biasa serta seluruh penutup harus tetap utuh.",
  },
];
const combinationCases = [
  {
    id: "long-caption-112",
    rows: 112,
    preface: 3,
    mixed: false,
    longCaption: true,
    sentences: [6, 6, 6],
    explanation:
      "Table (figureTable) berisi 112 baris, wajib memiliki header dan caption panjang. Caption/header berulang tanpa terpotong dan seluruh penutup harus utuh.",
  },
  {
    id: "custom-widths-96",
    rows: 96,
    preface: 3,
    mixed: true,
    widths: [80, 320, 160],
    sentences: [8, 8, 8],
    explanation:
      "Tabel dengan lebar kolom pilihan pengguna 80, 320, dan 160 piksel. Lebar harus konsisten pada halaman lanjutan dan isi sel tidak boleh hilang.",
  },
  {
    id: "two-tables-160",
    rows: 160,
    preface: 3,
    mixed: false,
    sentences: [6, 6, 6],
    tableGroups: [
      { rows: 80, widths: [80, 320, 160] },
      { rows: 80, widths: [100, 290, 170] },
    ],
    explanation:
      "Dua tabel panjang dalam satu bab, dipisahkan paragraf. Kedua tabel memiliki lebar kolom berbeda dan header bertanda A/B. Nomor, caption, dan lebar tiap tabel tidak boleh tertukar.",
  },
  {
    id: "table-grid-table-144",
    rows: 144,
    preface: 3,
    mixed: true,
    sentences: [8, 8, 8],
    gridBetween: 6,
    tableGroups: [
      { rows: 72, widths: [80, 320, 160] },
      { rows: 72, widths: [100, 290, 170], longCaption: true },
    ],
    explanation:
      "Dua Table (figureTable), keduanya wajib memakai header dan caption. Di antaranya ada Grid mandiri enam baris tanpa header/caption. Header, caption, nomor, dan pengaturan kolom Table tidak boleh bocor ke Grid.",
  },
];
const caseId = process.argv
  .find((argument) => argument.startsWith("--case="))
  ?.slice(7);
const diagnosticOptions = {
  diagnose: process.argv.includes("--diagnose"),
  handlerMode:
    process.argv
      .find((argument) => argument.startsWith("--table-handler="))
      ?.split("=")[1] || "baseline",
};
if (
  !["baseline", "disabled", "undo-insertions", "zero-offset-fallback"].includes(
    diagnosticOptions.handlerMode,
  )
)
  throw Error(
    "Unknown diagnostic table handler mode: " + diagnosticOptions.handlerMode,
  );
if (diagnosticOptions.handlerMode !== "baseline" && !diagnosticOptions.diagnose)
  throw Error("Diagnostic controls require --diagnose");
const cases = (
  process.argv.includes("--all")
    ? [...tableCases, ...paragraphCases, ...edgeCases, ...combinationCases]
    : process.argv.includes("--combinations")
      ? combinationCases
      : process.argv.includes("--edges")
        ? edgeCases
        : process.argv.includes("--paragraphs")
          ? paragraphCases
          : tableCases
).filter((options) => !caseId || options.id === caseId);
if (!cases.length) throw Error("Unknown case: " + caseId);
// Fixture contract follows the app's vocabulary. Raw HTML tables are an
// implementation detail: Table = figureTable; standalone content = Grid.
function assertFixtureContract(nodes, parentType) {
  for (const node of nodes) {
    if (node.type === "figureTable") {
      const caption =
        node.content?.filter((child) => child.type === "figcaption") || [];
      const tables =
        node.content?.filter((child) => child.type === "table") || [];
      const header = tables[0]?.content?.[0]?.content;
      if (
        caption.length !== 1 ||
        tables.length !== 1 ||
        !header?.length ||
        !header.every((cell) => cell.type === "tableHeader")
      )
        throw Error(
          "Table fixture must contain exactly one caption and a Table with a header",
        );
    }
    if (node.type === "table" && parentType !== "figureTable")
      throw Error("Standalone table fixture must be represented as Grid");
    if (
      node.type === "grid" &&
      (!node.content?.length ||
        !node.content.every(
          (row) =>
            row.type === "gridRow" &&
            row.content?.length &&
            row.content.every((cell) => cell.type === "gridCell"),
        ))
    )
      throw Error(
        "Grid fixture must use gridRow/gridCell and cannot contain a header or caption",
      );
    assertFixtureContract(node.content || [], node.type);
  }
}
const html = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:white"><div id="root"></div><script type="module">
import React,{useEffect,useRef} from 'react';import {createRoot} from 'react-dom/client';
import {PrintStyles} from '/src/components/submission/print-styles.tsx';
import {Engine} from '/src/compiler/engine/index.ts';import BaseHandler from '/src/compiler/handlers/basehandler.ts';import * as Paged from 'pagedjs';
import TableHandler from '/src/compiler/handlers/splitted-table-handler.ts';
import {Document} from '/src/editor/document/index.ts';import {HighTexDB} from '/src/editor/storage/hightex-db.ts';import {resolveDocumentProfile} from '/src/utils/document-profile.ts';import {Exporter} from '/src/utils/htx/exporter.ts';
window.config={get:()=>({language:'id'})};window.hightex={categories:async()=>[{id:1,name:'Skripsi',variant:'thesis',chapters:[{chapter:'1',title:'STRESS TEST PAGINATION TABEL'}]}]};
Paged.registerHandlers(BaseHandler);
${assertFixtureContract.toString()}
const paragraph=text=>({type:'paragraph',content:[{type:'text',text}]});
const cell=(text,header=false)=>({type:header?'tableHeader':'tableCell',attrs:{colspan:1,rowspan:1,colwidth:null,align:'left'},content:Array.isArray(text)?text:[paragraph(text)]});
const diagnosticOptions=${JSON.stringify(diagnosticOptions)};
window.layoutDiagnostics=[];
const rect=element=>{const r=element?.getBoundingClientRect();return r?{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right}:null;};
const snapshot=page=>{
 const area=page.element.querySelector('.pagedjs_page_content');
 const paragraphs=Array.from(area.querySelectorAll('p')).filter(p=>p.textContent.includes('POSTFACE-')||/P\\d{2}[SE]/.test(p.textContent));
 return {area:rect(area),figures:Array.from(area.querySelectorAll('figure')).map(el=>({box:rect(el),caption:rect(el.querySelector('figcaption')),thead:rect(el.querySelector('thead')),table:rect(el.querySelector('table')),rows:Array.from(el.querySelectorAll('tr')).map(row=>({text:row.textContent,box:rect(row),cells:Array.from(row.cells).map(cell=>({box:rect(cell),text:cell.textContent}))}))})),paragraphs:paragraphs.map(p=>({text:p.textContent,box:rect(p)}))};
};
if(diagnosticOptions.diagnose){
 const originalLayout=TableHandler.prototype.layout;
 TableHandler.prototype.layout=function(wrapper,layout){
  const page={element:wrapper.closest('.pagedjs_page')};const before=snapshot(page);
  const existing=new Set(wrapper.querySelectorAll('*'));
  if(diagnosticOptions.handlerMode!=='disabled')originalLayout.call(this,wrapper,layout);
  if(diagnosticOptions.handlerMode==='undo-insertions')for(const node of wrapper.querySelectorAll('figcaption,thead'))if(!existing.has(node))node.remove();
  window.layoutDiagnostics.push({phase:'layout',page:Number(page.element.dataset.pageNumber),before,after:snapshot(page)});
 };
 const originalOn=BaseHandler.prototype.onPageLayout;
 BaseHandler.prototype.onPageLayout=function(wrapper,token,layout){
  originalOn.call(this,wrapper,token,layout);
  const page=Number(wrapper.closest('.pagedjs_page').dataset.pageNumber);
  window.layoutDiagnostics.push({phase:'onPageLayout',page,height:layout.bounds.height,bottom:layout.bounds.bottom});
  if(layout.diagnosticWrapped)return;
  layout.diagnosticWrapped=true;
  const originalFind=layout.findOverflow,originalTextBreak=layout.textBreak;let zeroOffsetNode=null;
  layout.textBreak=function(node,...args){const offset=originalTextBreak.call(this,node,...args);if(offset===0)zeroOffsetNode=node;window.layoutDiagnostics.push({phase:'textBreak',page,text:node.textContent,offset,args,box:rect(node.parentElement)});return offset;};
  layout.findOverflow=function(rendered,bounds=this.bounds,gap=this.gap){
   zeroOffsetNode=null;let range=originalFind.call(this,rendered,bounds,gap);
   if(diagnosticOptions.handlerMode==='zero-offset-fallback'&&!range&&zeroOffsetNode){range=document.createRange();range.setStart(zeroOffsetNode,0);range.setEndAfter(rendered.lastChild);}
   if(rendered.textContent.includes('POSTFACE-'))window.layoutDiagnostics.push({phase:'findOverflow',page,hasOverflow:this.hasOverflow(rendered,bounds),gap,height:bounds.height,overflow:range?{node:range.startContainer.nodeName,text:range.startContainer.textContent?.slice(0,100),offset:range.startOffset}:null});
   return range;
  };
 };
 const originalOverflow=BaseHandler.prototype.onOverflow;
 BaseHandler.prototype.onOverflow=function(overflow,wrapper,bounds){
  const describe=range=>range?{node:range.startContainer.nodeName,text:range.startContainer.textContent?.slice(0,100),offset:range.startOffset}:null;
  const before=describe(overflow),result=originalOverflow.call(this,overflow,wrapper,bounds);
  window.layoutDiagnostics.push({phase:'onOverflow',page:Number(wrapper.closest('.pagedjs_page').dataset.pageNumber),before,after:describe(result||overflow)});
  return result;
 };
}
window.makeContent=options=>{
 const row=i=>({type:'tableRow',content:[cell('R'+String(i).padStart(4,'0')),cell([paragraph('M'+String(i).padStart(4,'0')+' Kebutuhan pengujian baris '+i+'. '+('Sistem harus mempertahankan seluruh isi tabel ketika berpindah halaman. '.repeat(options.longRow===i ? 80 : options.mixed ? (i%5)+1 : 1))),...(options.mixed&&i%7===0?[paragraph('Paragraf tambahan pada sel yang sama, tetap milik baris '+i+'.')]:[])]),cell('Verifikasi urutan dan keterbacaan. Z'+String(i).padStart(4,'0'))]});
 const header=options.mergedHeader ? (()=>{const code=cell('Kode baris',true),group=cell('Kebutuhan dan Hasil verifikasi',true);code.attrs.rowspan=2;group.attrs.colspan=2;return [{type:'tableRow',content:[code,group]},{type:'tableRow',content:[cell('Kebutuhan',true),cell('Hasil verifikasi',true)]}];})() : [{type:'tableRow',content:[cell('Kode baris',true),cell('Kebutuhan',true),cell('Hasil verifikasi',true)]}];
 const closing=options.sentences ? options.sentences.map((count,i)=>{
  const p=String(i+1).padStart(2,'0');
  return paragraph('POSTFACE-'+i+' '+Array.from({length:count},(_,j)=>{
   const s=String(j+1).padStart(2,'0');
   return 'P'+p+'S'+s+' Kalimat '+(j+1)+' pada paragraf '+(i+1)+' harus tampil utuh sesudah tabel, termasuk bagian tengah dan ujungnya P'+p+'E'+s+'.';
  }).join(' ')+' P'+p+'END');
 }) : Array.from({length:3},(_,i)=>paragraph('POSTFACE-'+i+' '+('Konten sesudah tabel wajib tetap tampil, berurutan, dan tidak tertimpa caption atau header lanjutan. '.repeat(3))));
 let offset=0;
 const groups=options.tableGroups||[{rows:options.rows,widths:options.widths,longCaption:options.longCaption}];
 const figures=groups.flatMap((group,index)=>{
  const body=Array.from({length:group.rows},()=>row(++offset));
  const heads=structuredClone(header);
  if(options.tableGroups)for(const h of heads)for(const c of h.content)c.content[0].content[0].text+=' '+String.fromCharCode(65+index);
  const rows=[...heads,...body];
  if(group.widths)for(const row of rows)row.content.forEach((cell,column)=>{cell.attrs.colwidth=[group.widths[column]];});
  const name=options.tableGroups?'stress-table-'+(index+1):'stress-table';
  const caption='STRESS_TABLE_CAPTION — '+options.id+(options.tableGroups?' / tabel '+(index+1):'')+(group.longCaption?' '+('Penjelasan panjang Table untuk menguji pembungkusan caption pada halaman lanjutan. '.repeat(3)):'');
  const figure={type:'figureTable',attrs:{id:name,figureId:name,groupId:''},content:[{type:'figcaption',content:[{type:'text',text:caption}]},{type:'table',content:rows}]};
  const grid=options.gridBetween?{type:'grid',attrs:{id:'stress-grid'},content:Array.from({length:options.gridBetween},(_,r)=>({type:'gridRow',content:Array.from({length:3},(_,c)=>({type:'gridCell',attrs:{colspan:1,rowspan:1,colwidth:[[150,210,190][c]],align:'left'},content:[paragraph('G'+String(r+1).padStart(4,'0')+String.fromCharCode(65+c)+' Grid mandiri kolom '+(c+1)+'.')]}))}))}:null;
  return index?[paragraph('BETWEEN_TABLE_'+index+' Paragraf di antara Table harus lengkap dan tetap berada sebelum Table berikutnya.'),...(grid?[grid]:[]),figure]:[figure];
 });
 return [{type:'heading',attrs:{level:1,id:'stress-heading'},content:[{type:'text',text:'STRESS TEST PAGINATION TABEL'}]},...(options.explanation?[paragraph('PENJELASAN KASUS: '+options.explanation),paragraph('HASIL YANG DIHARAPKAN: semua baris tabel dan semua kalimat penutup utuh serta berurutan pada preview dan PDF. PppSss menandai awal kalimat, PppEss menandai ujung kalimat, dan PppEND menandai akhir paragraf; pp adalah nomor paragraf dan ss nomor kalimat. Tidak boleh ada teks yang hilang di antara penanda.')]:[]),...Array.from({length:options.preface},(_,i)=>paragraph('PREFACE-'+i+' '+('Paragraf sebelum tabel digunakan untuk menguji batas halaman dan aliran teks. '.repeat(3)))),paragraph('BEFORE_TABLE_SENTINEL'),...figures,paragraph('AFTER_TABLE_SENTINEL'),...closing];
};
function Stress(){const source=useRef(null),render=useRef(null);
 useEffect(()=>{window.run=async options=>{
  const started=performance.now(), db=HighTexDB.getInstance();await db.open();
  const id='stress-'+options.id;const content=window.makeContent(options);assertFixtureContract(content);const chapterId=id+'.1'+(options.version?'.'+options.version:'');
  await db.documents.put({id,title:'Stress test tabel '+options.id,altTitle:'Multi-page table pagination stress test',category:'1',keywords:{indonesian:[],english:[]},config:{},profile:{name:'Penguji Pagination',nim:'STRESS001',advisorName:'',advisorNip:'',cv:''}});
  await db.chapters.put({id:chapterId,content});window.fixture={content};if(options.version)await db.chapters.put({id:id+'.1',content:[paragraph('DRAFT_ONLY_MUST_NOT_APPEAR')]});
  const before=JSON.stringify((await db.chapters.get(chapterId)).content);
  const archive=await new Exporter(id).exportForPush();window.fixture.archive=Array.from(archive.file);
  const documentModel=await new Document(id,options.version).warm({activate:false});
  const chapter=documentModel.chapters.find(chapter=>chapter.getChapter()==='1');
  const engine=Engine.getInstance().mount(source.current).withConfig({profile:resolveDocumentProfile(documentModel.getDocument()),parser:{mode:'single',chapter},paged:{content:source.current.parentElement,renderTo:render.current}});
  await engine.run();window.sourceHTML=source.current.innerHTML;await engine.createPaged();
  if(engine.error)throw engine.error;
  return {elapsedMs:Math.round(performance.now()-started),sourceUnchanged:before===JSON.stringify((await db.chapters.get(chapterId)).content),archive:Array.from(archive.file),content};
 };window.ready=true;},[]);
 return React.createElement(React.Fragment,null,React.createElement('div',{style:{display:'none'}},React.createElement('section',{className:'content',ref:source})),React.createElement('div',{id:'paginated-output',ref:render}));}
createRoot(document.getElementById('root')).render(React.createElement(PrintStyles,{onError:error=>{window.error=String(error)}},React.createElement(Stress)));
</script></body></html>`;
const execute = (code) =>
  win.webContents.executeJavaScript(
    `(async()=>await eval(${JSON.stringify(code)}))()`,
  );
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(code) {
  const end = Date.now() + 45000;
  while (!(await execute(`Boolean(${code})`))) {
    if (Date.now() > end) throw Error("Timed out: " + code);
    await pause(75);
  }
}
function issue(result, condition, message) {
  if (!condition) result.issues.push(message);
}
function surroundingParagraphs(result, text, options, format) {
  const pre = Array.from(text.matchAll(/PREFACE-(\d+)\b/g), (match) =>
    Number(match[1]),
  );
  const post = Array.from(text.matchAll(/POSTFACE-(\d+)\b/g), (match) =>
    Number(match[1]),
  );
  issue(
    result,
    JSON.stringify(pre) ===
      JSON.stringify(
        Array.from({ length: options.preface }, (_, index) => index),
      ),
    format + " preceding paragraphs missing or reordered: " + pre.join(","),
  );
  issue(
    result,
    JSON.stringify(post) ===
      JSON.stringify(
        Array.from(
          { length: options.sentences?.length ?? 3 },
          (_, index) => index,
        ),
      ),
    format + " following paragraphs missing or reordered: " + post.join(","),
  );
}
// Ignore layout whitespace and the numeric running footer, but retain every
// letter/digit of the sentence. Checking only paragraph starts misses clipping.
const normalizeText = (value) =>
  value.replace(/^\s*\d+\s*$/gm, "").replace(/[^a-zA-Z0-9]/g, "");
function pdfColumns(bbox, fragments) {
  const decode = (text) =>
    text.replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi, (entity) => {
      const named = {
        "&amp;": "&",
        "&lt;": "<",
        "&gt;": ">",
        "&quot;": '"',
        "&apos;": "'",
      };
      return (
        named[entity] ??
        String.fromCodePoint(
          entity.startsWith("&#x")
            ? parseInt(entity.slice(3, -1), 16)
            : Number(entity.slice(2, -1)),
        )
      );
    });
  const pages = Array.from(
    bbox.matchAll(/<page width="([\d.]+)" height="[\d.]+">([\s\S]*?)<\/page>/g),
    (page) => ({
      width: Number(page[1]),
      words: Array.from(
        page[2].matchAll(
          /<word xMin="([\d.-]+)" yMin="([\d.-]+)" xMax="([\d.-]+)" yMax="([\d.-]+)">([\s\S]*?)<\/word>/g,
        ),
        (word) => ({
          x: (Number(word[1]) + Number(word[3])) / 2,
          y: (Number(word[2]) + Number(word[4])) / 2,
          text: decode(word[5]),
        }),
      ),
    }),
  );
  const columns = ["", "", ""];
  for (const fragment of fragments) {
    const page = pages[fragment.page - 1];
    if (!page || !fragment.bodyBox) continue;
    const scale = page.width / fragment.pageWidth,
      box = fragment.bodyBox;
    let left = box.left;
    fragment.columnWidths.forEach((width, index) => {
      const right = left + width;
      columns[index] += page.words
        .filter(
          (word) =>
            word.x >= left * scale &&
            word.x < right * scale &&
            word.y >= box.top * scale &&
            word.y < box.bottom * scale,
        )
        .sort((a, b) => (Math.abs(a.y - b.y) > 1 ? a.y - b.y : a.x - b.x))
        .map((word) => word.text)
        .join(" ");
      left = right;
    });
  }
  return columns;
}
function auditClosingParagraphs(result, text, content, format) {
  text = text.slice(Math.max(0, text.indexOf("AFTER_TABLE_SENTINEL")));
  const rendered = normalizeText(text);
  const paragraphs = content.filter(
    (node) =>
      node.type === "paragraph" &&
      node.content?.[0]?.text?.startsWith("POSTFACE-"),
  );
  result.paragraphAudit ??= {};
  result.paragraphAudit[format] = paragraphs.map((node, index) => {
    const source = node.content.map((part) => part.text ?? "").join("");
    const sentences = Array.from(
      source.matchAll(/(P\d{2}S\d{2})(.*?)(P\d{2}E\d{2})/g),
    );
    const changed = sentences.flatMap(([whole, start, , end], sentence) => {
      if (rendered.includes(normalizeText(whole))) return [];
      const from = rendered.indexOf(start),
        to = rendered.indexOf(end, Math.max(from, 0));
      return [
        {
          sentence: sentence + 1,
          startPresent: from !== -1,
          endPresent: to !== -1,
          expected: whole,
          actual:
            from !== -1 && to >= from
              ? rendered.slice(from, to + end.length)
              : null,
        },
      ];
    });
    const wholeParagraphPresent = rendered.includes(normalizeText(source));
    issue(
      result,
      wholeParagraphPresent,
      format +
        " closing paragraph " +
        (index + 1) +
        " incomplete or reordered; affected sentences: " +
        (changed.map((entry) => entry.sentence).join(",") ||
          "paragraph boundaries/order"),
    );
    return {
      paragraph: index + 1,
      expectedSentences: sentences.length,
      completeSentences: sentences.length - changed.length,
      startPresent: text.includes("POSTFACE-" + index),
      endPresent: rendered.includes(
        "P" + String(index + 1).padStart(2, "0") + "END",
      ),
      wholeParagraphPresent,
      changed,
    };
  });
}
const metricsCode = `(()=>{
 const pages=Array.from(document.querySelectorAll('.pagedjs_page'));
 const boxes=[], textOverflow=[], columnTexts=['','',''], tableFragments=[], gridFragments=[], gridColumnTexts=['','',''];
 const metrics=pages.map((page,index)=>{
  const area=page.querySelector('.pagedjs_page_content'), bounds=area.getBoundingClientRect();
  const walker=document.createTreeWalker(area,NodeFilter.SHOW_TEXT);
  while(walker.nextNode()){
   const node=walker.currentNode;if(!node.textContent.trim())continue;
   const range=document.createRange();range.selectNodeContents(node);
   for(const r of range.getClientRects())if(r.width>0&&r.height>0&&(r.left<bounds.left-2||r.right>bounds.right+2||r.top<bounds.top-2||r.bottom>bounds.bottom+2))textOverflow.push({page:index+1,text:node.textContent.slice(0,100),left:r.left-bounds.left,top:r.top-bounds.top,right:r.right-bounds.left,bottom:r.bottom-bounds.top});
  }
  const figures=Array.from(page.querySelectorAll('figure[data-type="figureTable"]'));
  for(const table of page.querySelectorAll('.node-grid > table')){
   const pageBox=page.getBoundingClientRect(),body=table.tBodies[0]?.getBoundingClientRect(),row=table.rows[0];
   gridFragments.push({page:index+1,pageWidth:pageBox.width,bodyBox:body?{left:table.getBoundingClientRect().left-pageBox.left,top:Math.max(body.top,bounds.top)-pageBox.top,bottom:Math.min(body.bottom,bounds.bottom)-pageBox.top}:null,columnWidths:row?Array.from(row.cells,cell=>cell.getBoundingClientRect().width):[],headerNodes:table.querySelectorAll('thead,th').length,captionNodes:table.parentElement.querySelectorAll('caption,figcaption').length,managedColumns:!!table.querySelector('[data-hightex-columns]'),fixedLayout:table.style.tableLayout==='fixed',inFigure:!!table.closest('figure[data-type="figureTable"]')});
   for(const row of table.rows)Array.from(row.cells).forEach((cell,index)=>{if(index<3)gridColumnTexts[index]+=cell.textContent;});
  }
  for(const figure of figures){
   const caption=figure.querySelector(':scope > figcaption'),table=figure.querySelector('table');
   const row=Array.from(table?.rows||[]).find(row=>row.cells.length===3&&Array.from(row.cells).every(cell=>cell.colSpan===1));
   const pageBox=page.getBoundingClientRect(),body=table?.tBodies[0]?.getBoundingClientRect();
   tableFragments.push({page:index+1,pageWidth:pageBox.width,bodyBox:body?{left:table.getBoundingClientRect().left-pageBox.left,top:Math.max(body.top,bounds.top)-pageBox.top,bottom:Math.min(body.bottom,bounds.bottom)-pageBox.top}:null,number:caption?.getAttribute('data-numbering')||'',caption:caption?.textContent||'',prefix:caption?getComputedStyle(caption,'::before').content:'',continuation:caption?.classList.contains('continueing')||false,header:table?.tHead?.textContent||'',body:table?.tBodies[0]?.textContent||'',rows:figure.textContent.match(/R\\d{4}/g)||[],width:table?.getBoundingClientRect().width||0,columnWidths:row?Array.from(row.cells,cell=>cell.getBoundingClientRect().width):[]});
  }
  for(const figure of figures)for(const row of figure.querySelectorAll('tbody tr'))Array.from(row.cells).forEach((cell,index)=>{if(index<3)columnTexts[index]+=cell.textContent;});
  for(const figure of figures)for(const element of figure.querySelectorAll('tr,figcaption')){const box=element.getBoundingClientRect();if(box.height && (box.bottom>bounds.bottom+2||box.top<bounds.top-2))boxes.push({page:index+1,tag:element.tagName,top:Math.round(box.top-bounds.top),bottom:Math.round(box.bottom-bounds.top),limit:Math.round(bounds.height),text:element.textContent.slice(0,70)});}
  const caption=figures[0]?.querySelector('figcaption');
  return {page:index+1,text:area.textContent,rows:(area.textContent.match(/R\\d{4}/g)||[]),figures:figures.length,headers:figures.map(figure=>figure.querySelector('thead')?.textContent||''),bodyText:figures.map(figure=>figure.querySelector('tbody')?.textContent||'').join(''),bodyHeight:figures.flatMap(figure=>Array.from(figure.querySelectorAll('tbody tr'))).reduce((sum,row)=>sum+row.getBoundingClientRect().height,0),areaHeight:bounds.height,caption:caption?.textContent||'',captionPrefix:caption?getComputedStyle(caption,'::before').content:'',continuation:caption?.classList.contains('continueing')||false,captionSuffix:caption?getComputedStyle(caption,'::after').content:'',height:Math.round(page.getBoundingClientRect().height),width:Math.round(page.getBoundingClientRect().width)};
 });
 return {pages:metrics,overflow:boxes,textOverflow,columnTexts,tableFragments,gridColumnTexts,gridFragments,text:metrics.map(page=>page.text).join(' '),sourceTables:window.sourceHTML.match(/<table/g)?.length||0};
})()`;
app
  .whenReady()
  .then(async () => {
    const { createServer: createVite } = await import("vite"),
      react = (await import("@vitejs/plugin-react")).default,
      tailwind = (await import("@tailwindcss/vite")).default;
    vite = await createVite({
      root,
      configFile: false,
      cacheDir: path.join(artifacts, "vite"),
      plugins: [react(), tailwind()],
      resolve: { alias: { "@": path.join(root, "src") } },
      server: { middlewareMode: true, hmr: false },
      logLevel: "error",
    });
    server = createServer(async (req, res) => {
      if (req.url === "/fixture") {
        res.setHeader("Content-Type", "text/html");
        res.end(await vite.transformIndexHtml("/fixture", html));
      } else
        vite.middlewares(req, res, () => {
          res.writeHead(404);
          res.end();
        });
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    for (const options of cases) {
      console.log("START " + options.id);
      win = new BrowserWindow({
        width: 1000,
        height: 1400,
        show: false,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          backgroundThrottling: false,
        },
      });
      const result = {
        ...options,
        ...diagnosticOptions,
        issues: [],
        consoleErrors: [],
      };
      results.push(result);
      win.webContents.on("console-message", (event) => {
        if (event.level === "error") result.consoleErrors.push(event.message);
      });
      try {
        await win.loadURL(
          "http://127.0.0.1:" + server.address().port + "/fixture",
        );
        await until("window.ready || window.error");
        const generated = await Promise.race([
          execute("window.run(" + JSON.stringify(options) + ")"),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(Error("Render exceeded 90 seconds")),
              90000,
            ),
          ),
        ]);
        result.elapsedMs = generated.elapsedMs;
        result.sourceUnchanged = generated.sourceUnchanged;
        assertFixtureContract(generated.content);
        result.fixtureContractValid = true;
        writeFileSync(
          path.join(artifacts, options.id + ".hightex"),
          Buffer.from(generated.archive),
        );
        writeFileSync(
          path.join(artifacts, options.id + ".json"),
          JSON.stringify(generated.content, null, 2),
        );
        const metrics = await execute(metricsCode);
        result.metrics = metrics;
        const sourceFigures = generated.content.filter(
          (node) => node.type === "figureTable",
        );
        const sourceRows = sourceFigures.flatMap((figure) =>
          figure.content
            .find((node) => node.type === "table")
            .content.filter((row) => row.content[0]?.type === "tableCell"),
        );
        const sourceGridRows = generated.content
          .filter((node) => node.type === "grid")
          .flatMap((node) => node.content);
        const nodeText = (node) =>
          (node.text || "") + (node.content || []).map(nodeText).join("");
        for (let column = 0; column < 3; column++)
          issue(
            result,
            normalizeText(metrics.columnTexts[column]) ===
              normalizeText(
                sourceRows.map((row) => nodeText(row.content[column])).join(""),
              ),
            "DOM full column " + (column + 1) + " differs from source text",
          );
        for (let column = 0; column < 3; column++)
          issue(
            result,
            normalizeText(metrics.gridColumnTexts[column]) ===
              normalizeText(
                sourceGridRows
                  .map((row) => nodeText(row.content[column]))
                  .join(""),
              ),
            "DOM Grid column " + (column + 1) + " differs from source text",
          );
        issue(
          result,
          sourceGridRows.length
            ? metrics.gridFragments.length > 0
            : metrics.gridFragments.length === 0,
          "Grid presence differs from source",
        );
        for (const grid of metrics.gridFragments)
          issue(
            result,
            grid.headerNodes === 0 &&
              grid.captionNodes === 0 &&
              !grid.managedColumns &&
              !grid.fixedLayout &&
              !grid.inFigure,
            "Grid received Table header/caption or handler styles on page " +
              grid.page,
          );
        if (diagnosticOptions.diagnose) {
          writeFileSync(
            path.join(artifacts, options.id + "-layout-diagnostics.json"),
            JSON.stringify(await execute("window.layoutDiagnostics"), null, 2),
          );
          writeFileSync(
            path.join(artifacts, options.id + "-text-geometry.json"),
            JSON.stringify(
              await execute(`(()=>{
            return Array.from(document.querySelectorAll('.pagedjs_page')).map((page,index)=>{
              const area=page.querySelector('.pagedjs_page_content'),bounds=area.getBoundingClientRect();
              const text=[];const walker=document.createTreeWalker(area,NodeFilter.SHOW_TEXT);
              while(walker.nextNode()){
                const node=walker.currentNode;if(!/POSTFACE-|P\\d{2}[SE]|R\\d{4}/.test(node.textContent))continue;
                const range=document.createRange();range.selectNodeContents(node);
                text.push({text:node.textContent,rects:Array.from(range.getClientRects()).map(r=>({left:r.left-bounds.left,top:r.top-bounds.top,right:r.right-bounds.left,bottom:r.bottom-bounds.top}))});
              }
              return {page:index+1,width:bounds.width,height:bounds.height,columnWidth:getComputedStyle(area).columnWidth,columnGap:getComputedStyle(area).columnGap,text};
            });
          })()`),
              null,
              2,
            ),
          );
        }
        surroundingParagraphs(result, metrics.text, options, "DOM");
        if (options.sentences)
          auditClosingParagraphs(
            result,
            metrics.text,
            generated.content,
            "DOM",
          );
        const tablePages = metrics.pages.filter((page) => page.figures);
        const bodyPages = tablePages.filter((page) => page.rows.length);
        result.bodyTablePages = bodyPages.map((page) => page.page);
        for (const page of tablePages)
          issue(
            result,
            page.bodyText.trim().length > 0,
            "Orphan caption/header without body rows on page " + page.page,
          );
        const utilization = bodyPages
          .slice(1, -1)
          .map((page) => page.bodyHeight / page.areaHeight)
          .sort((a, b) => a - b);
        if (utilization.length >= 3) {
          result.medianContinuationUtilization =
            utilization[Math.floor(utilization.length / 2)];
          issue(
            result,
            result.medianContinuationUtilization >= 0.35,
            "Continuation pages use less than 35% of available height (median " +
              Math.round(result.medianContinuationUtilization * 100) +
              "%)",
          );
        }
        issue(
          result,
          tablePages.length >= 3,
          "Table does not span more than two pages",
        );
        issue(
          result,
          generated.sourceUnchanged,
          "Pagination changed source chapter JSON",
        );
        for (const prefix of ["R", "M", "Z"])
          for (let i = 1; i <= options.rows; i++) {
            const token = prefix + String(i).padStart(4, "0");
            const count = metrics.text.split(token).length - 1;
            issue(
              result,
              count === 1,
              "DOM " + token + " occurs " + count + " times",
            );
          }
        const rowOrder = metrics.pages.flatMap((page) => page.rows);
        issue(
          result,
          rowOrder.join(",") ===
            Array.from(
              { length: options.rows },
              (_, i) => "R" + String(i + 1).padStart(4, "0"),
            ).join(","),
          "Body row order differs from source",
        );
        issue(
          result,
          metrics.text.indexOf("BEFORE_TABLE_SENTINEL") <
            metrics.text.indexOf("R0001"),
          "Before-table paragraph is missing or misplaced",
        );
        issue(
          result,
          metrics.text.indexOf("AFTER_TABLE_SENTINEL") >
            metrics.text.lastIndexOf(
              "Z" + String(options.rows).padStart(4, "0"),
            ),
          "After-table paragraph is missing or misplaced",
        );
        issue(
          result,
          !metrics.text.includes("DRAFT_ONLY_MUST_NOT_APPEAR"),
          "Saved-version preview used draft content",
        );
        for (const [index, sourceFigure] of sourceFigures.entries()) {
          const number = "1." + (index + 1);
          const fragments = metrics.tableFragments.filter(
            (fragment) => fragment.number === number,
          );
          const sourceTable = sourceFigure.content.find(
            (node) => node.type === "table",
          );
          const sourceHeader = sourceTable.content
            .filter((row) =>
              row.content.every((cell) => cell.type === "tableHeader"),
            )
            .map(nodeText)
            .join("");
          const sourceCaption = nodeText(
            sourceFigure.content.find((node) => node.type === "figcaption"),
          );
          issue(
            result,
            fragments.length >= 3,
            "Table " +
              number +
              " does not span more than two pages or numbering is missing",
          );
          const reference = fragments.find(
            (fragment) => fragment.columnWidths.length === 3,
          )?.columnWidths;
          const expectedWidths =
            options.tableGroups?.[index]?.widths || options.widths;
          for (const [fragmentIndex, fragment] of fragments.entries()) {
            const label = "Table " + number + " page " + fragment.page;
            issue(
              result,
              fragment.body.trim().length > 0,
              label + " orphan caption/header",
            );
            issue(
              result,
              fragment.caption === sourceCaption,
              label + " caption differs from source",
            );
            issue(
              result,
              fragment.header === sourceHeader,
              label + " header differs from source",
            );
            issue(
              result,
              fragment.prefix.includes(number),
              label + " incorrect caption number",
            );
            issue(
              result,
              fragment.continuation === fragmentIndex > 0,
              label + " incorrect continuation caption",
            );
            issue(
              result,
              reference?.every(
                (width, column) =>
                  Math.abs(width - fragment.columnWidths[column]) < 1,
              ),
              label + " column widths changed",
            );
            if (expectedWidths)
              issue(
                result,
                expectedWidths.every(
                  (width, column) => fragment.columnWidths[column] >= width - 1,
                ),
                label + " custom column widths not preserved",
              );
          }
          if (index) {
            const token = "BETWEEN_TABLE_" + index;
            issue(
              result,
              metrics.text.includes(token),
              "Missing inter-table paragraph " + index,
            );
          }
        }
        issue(
          result,
          metrics.tableFragments.every((fragment) =>
            sourceFigures.some(
              (_, index) => fragment.number === "1." + (index + 1),
            ),
          ),
          "Unexpected table number",
        );
        issue(
          result,
          !metrics.overflow.length,
          "Rows/captions overflow content bounds: " + metrics.overflow.length,
        );
        issue(
          result,
          !metrics.textOverflow.length,
          "Text fragments outside page content: " + metrics.textOverflow.length,
        );
        const pdf = await win.webContents.printToPDF({
          printBackground: true,
          preferCSSPageSize: false,
          pageSize: "A4",
          displayHeaderFooter: false,
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
        });
        const file = path.join(artifacts, options.id + ".pdf");
        writeFileSync(file, pdf);
        result.pdfPages = (await PDFDocument.load(pdf)).getPageCount();
        issue(
          result,
          result.pdfPages === metrics.pages.length,
          "Native PDF page count differs from preview",
        );
        const text = execFileSync("pdftotext", ["-layout", file, "-"], {
          encoding: "utf8",
        });
        writeFileSync(path.join(artifacts, options.id + ".txt"), text);
        const pdfPageTexts = text.split("\f");
        for (const fragment of metrics.tableFragments)
          issue(
            result,
            normalizeText(pdfPageTexts[fragment.page - 1] || "").includes(
              normalizeText(
                "Tabel " + fragment.number + " " + fragment.caption,
              ),
            ),
            "PDF table " +
              fragment.number +
              " caption incomplete on page " +
              fragment.page,
          );
        const bbox = execFileSync("pdftotext", ["-bbox", file, "-"], {
          encoding: "utf8",
          maxBuffer: 16 * 1024 * 1024,
        });
        writeFileSync(
          path.join(artifacts, options.id + "-pdf-bbox.html"),
          bbox,
        );
        const pdfColumnTexts = pdfColumns(bbox, metrics.tableFragments);
        result.pdfColumnTexts = pdfColumnTexts;
        const pdfGridColumnTexts = pdfColumns(bbox, metrics.gridFragments);
        result.pdfGridColumnTexts = pdfGridColumnTexts;
        for (let column = 0; column < 3; column++)
          issue(
            result,
            normalizeText(pdfGridColumnTexts[column]) ===
              normalizeText(
                sourceGridRows
                  .map((row) => nodeText(row.content[column]))
                  .join(""),
              ),
            "PDF Grid column " + (column + 1) + " differs from source text",
          );
        for (let column = 0; column < 3; column++)
          issue(
            result,
            normalizeText(pdfColumnTexts[column]) ===
              normalizeText(
                sourceRows.map((row) => nodeText(row.content[column])).join(""),
              ),
            "PDF full column " + (column + 1) + " differs from source text",
          );
        surroundingParagraphs(result, text, options, "PDF");
        for (let index = 1; index < sourceFigures.length; index++) {
          const sentence = nodeText(
            generated.content.find(
              (node) =>
                node.type === "paragraph" &&
                nodeText(node).startsWith("BETWEEN_TABLE_" + index),
            ),
          );
          issue(
            result,
            normalizeText(text).includes(normalizeText(sentence)),
            "PDF inter-table paragraph " + index + " incomplete",
          );
          const rowsBefore = (options.tableGroups || [])
            .slice(0, index)
            .reduce((sum, group) => sum + group.rows, 0);
          issue(
            result,
            text.indexOf("BETWEEN_TABLE_" + index) >
              text.indexOf("Z" + String(rowsBefore).padStart(4, "0")) &&
              text.indexOf("BETWEEN_TABLE_" + index) <
                text.indexOf("R" + String(rowsBefore + 1).padStart(4, "0")),
            "PDF inter-table paragraph " + index + " misplaced",
          );
        }
        if (options.sentences)
          auditClosingParagraphs(result, text, generated.content, "PDF");
        for (const prefix of ["R", "M", "Z"])
          for (let i = 1; i <= options.rows; i++) {
            const token = prefix + String(i).padStart(4, "0");
            const count =
              normalizeText(
                pdfColumnTexts[["R", "M", "Z"].indexOf(prefix)],
              ).split(token).length - 1;
            issue(
              result,
              count === 1,
              "PDF " + token + " occurs " + count + " times",
            );
          }
        issue(
          result,
          text.indexOf("BEFORE_TABLE_SENTINEL") < text.indexOf("M0001") &&
            text.indexOf("AFTER_TABLE_SENTINEL") >
              text.lastIndexOf("Z" + String(options.rows).padStart(4, "0")),
          "PDF surrounding content order differs from source",
        );
        issue(
          result,
          text.includes("BEFORE_TABLE_SENTINEL") &&
            text.includes("AFTER_TABLE_SENTINEL"),
          "Surrounding content is missing from PDF",
        );
        writeFileSync(
          path.join(artifacts, options.id + "-paginated.html"),
          await execute("document.documentElement.outerHTML"),
        );
        // Capture each table page at 100%, independently of the scroll viewport.
        const screenshotPages = tablePages.filter(
          (_, index) =>
            index === 0 ||
            index === Math.floor(tablePages.length / 2) ||
            index === tablePages.length - 1,
        );
        if (options.sentences)
          for (const page of metrics.pages.filter((page) =>
            /POSTFACE-|P\d{2}[SE]/.test(page.text),
          ))
            if (!screenshotPages.includes(page)) screenshotPages.push(page);
        for (const page of screenshotPages) {
          await execute(
            `(()=>{const pages=document.querySelectorAll('.pagedjs_page');pages.forEach((el,index)=>{el.style.display=index===${page.page - 1}?'':'none'});window.scrollTo(0,0);})()`,
          );
          await pause(60);
          writeFileSync(
            path.join(artifacts, options.id + "-page-" + page.page + ".png"),
            (await win.webContents.capturePage()).toPNG(),
          );
        }
        result.tablePages = tablePages.map((page) => page.page);
      } catch (error) {
        result.issues.push(String(error));
        // Preserve repro inputs and partial pagination even when the compiler
        // aborts before it can return normal metrics or produce a PDF.
        try {
          const failed = await execute(
            "({fixture:window.fixture,html:document.documentElement.outerHTML,diagnostics:window.layoutDiagnostics})",
          );
          if (failed.fixture?.archive)
            writeFileSync(
              path.join(artifacts, options.id + ".hightex"),
              Buffer.from(failed.fixture.archive),
            );
          if (failed.fixture?.content)
            writeFileSync(
              path.join(artifacts, options.id + ".json"),
              JSON.stringify(failed.fixture.content, null, 2),
            );
          writeFileSync(
            path.join(artifacts, options.id + "-paginated.html"),
            failed.html,
          );
          if (diagnosticOptions.diagnose)
            writeFileSync(
              path.join(artifacts, options.id + "-layout-diagnostics.json"),
              JSON.stringify(failed.diagnostics, null, 2),
            );
        } catch (captureError) {
          result.issues.push(
            "Failure artifact capture: " + String(captureError),
          );
        }
      } finally {
        win.destroy();
        win = null;
        writeFileSync(
          path.join(artifacts, "results.json"),
          JSON.stringify(results, null, 2),
        );
      }
      console.log(
        JSON.stringify({
          case: options.id,
          rows: options.rows,
          pages: result.pdfPages,
          tablePages: result.tablePages,
          elapsedMs: result.elapsedMs,
          issues: result.issues.length,
          firstIssues: result.issues.slice(0, 6),
        }),
      );
    }
    console.log("Artifacts: " + artifacts);
    if (results.some((result) => result.issues.length)) process.exitCode = 1;
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    win?.destroy();
    await vite?.close();
    server?.close();
    app.exit(process.exitCode || 0);
  });
