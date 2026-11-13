// Same JSON through the live editor and the production compiler/Paged.js stack.
// env -u ELECTRON_RUN_AS_NODE node_modules/.bin/electron tests/integration/editor-pagination-compare.cjs
const { BrowserWindow } = require("electron");
const { createHash } = require("node:crypto");
const { mkdirSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");

function cases(citeKey) {
  let serial = 0;
  const marker = () => `M${String(++serial).padStart(6,"0")}X`;
  const text = (count, prefix = "") => Array.from({length:count},()=>`${marker()} ${prefix}Penelitian mengukur kebutuhan pengguna serta ketepatan dan kestabilan hasil. `).join("");
  const p = (count, prefix) => ({type:"paragraph",content:[{type:"text",text:text(count,prefix)}]});
  const caption = label => ({type:"figcaption",content:[{type:"text",text:text(1,label)}]});
  const heading = {type:"heading",attrs:{level:1,id:"comparison-heading"},content:[{type:"text",text:"Introduction"}]};
  const doc = content => ({type:"doc",content:[heading,...content]});
  const cell = (count,attrs={}) => ({type:"tableCell",attrs,content:[p(count)]});
  const header = (label,attrs={}) => ({type:"tableHeader",attrs,content:[p(1,label)]});
  const table = (id,rows,longCell=false) => ({type:"figureTable",attrs:{id,figureId:id},content:[caption("Tabel pembanding. "),{type:"table",content:[
    {type:"tableRow",content:[header("Kelompok ",{rowspan:2}),header("Hasil ",{colspan:2})]},
    {type:"tableRow",content:[header("Awal "),header("Akhir ")]},
    ...Array.from({length:rows},(_,i)=>({type:"tableRow",content:[cell(longCell&&i===3?65:1),cell(i%5===0?4:1),cell(1)]})),
  ]}]});
  const image = id => ({type:"imageFigure",attrs:{id,figureId:id},content:[{type:"image",attrs:{src:"fixture-image",width:380}},caption("Gambar pembanding. ")]});
  const list = {type:"orderedList",attrs:{start:7},content:Array.from({length:12},(_,i)=>({type:"listItem",content:[p(3+i%6),{type:"orderedList",attrs:{start:3},content:[{type:"listItem",content:[p(2)]},{type:"listItem",content:[p(1)]}]}]}))};
  const code = () => ({type:"codeBlock",attrs:{language:"plaintext"},content:[{type:"text",text:Array.from({length:70},(_,i)=>`// ${marker()} baris_${i}`).join("\n")}]});
  const nested=table("nested-parent",15);
  nested.content[1].content.push({type:"tableRow",content:[{type:"tableCell",attrs:{colspan:3},content:[p(14),{
    type:"table",content:Array.from({length:20},(_,i)=>({type:"tableRow",content:[i===0?header("Bagian dalam "):cell(3)]})),
  },p(3)]}]});
  const fixtures = [
    {name:"paragraphs-and-headings",doc:doc(Array.from({length:35},(_,i)=>[
      ...(i%5===0?[{type:"heading",attrs:{level:2,id:`section-${i}`},content:[{type:"text",text:text(1,"Bagian ")}]}]:[]),p(1+i%7),
    ]).flat())},
    {name:"numbered-nested-lists",doc:doc([p(15),list,p(6)])},
    {name:"merged-headers-and-long-cell",doc:doc([p(12),table("comparison-table",35,true),p(16)])},
    {name:"images-math-citations-references",doc:doc([p(10),image("comparison-image"),...Array.from({length:12},(_,i)=>[
      p(4),{type:"paragraph",content:[{type:"text",text:text(2)},
        {type:"mathInline",attrs:{latex:"\\dfrac{\\sum_{i=1}^{100}x_i^2}{\\sqrt{1+x^2}}"}},
        {type:"cite",attrs:{cite:citeKey}}, {type:"variable",attrs:{name:"title"}},
        {type:"refComponent",attrs:{ref:"imageFigure",link:"comparison-image"}},
        {type:"text",text:text(2)}]},
    ]).flat(),{type:"blockMath",attrs:{id:"comparison-equation",latex:"\\sum_{i=1}^{100} x_i^2 = \\dfrac{a+b}{c+d}"}},p(4)])},
    {name:"code-and-forced-breaks",doc:doc([p(5),code(),p(4),{type:"horizontalRule"},p(3),{type:"orderedList",attrs:{start:4},content:[{type:"listItem",content:[p(2),{type:"horizontalRule"},p(2)]}]},p(3)])},
    {name:"nested-table-after-long-prelude",doc:doc([p(10),nested,p(12)])},
  ];
  if(process.env.HIGHTEX_PAGINATION_COMPARE_EXTENDED==='1') {
    const h=(level)=>({type:'heading',attrs:{level},content:[{type:'text',text:text(1,'Bagian ')}]});
    const figure=(id,rows)=>({type:'figureTable',attrs:{id,figureId:id},content:[caption('Tabel batas. '),{type:'table',content:rows}]});
    const row=content=>({type:'tableRow',content});
    const grid=(rows)=>({type:'table',content:[row([header('Kolom satu '),header('Kolom dua ')]),...Array.from({length:rows},()=>row([cell(2),cell(1)]))]});
    fixtures.push(
      {name:'headings-and-empty-paragraphs',doc:doc(Array.from({length:25},(_,i)=>[p(2+i%6),{type:'paragraph'},h(2),h(3),p(1),{type:'paragraph'}]).flat())},
      {name:'standalone-without-table-header',doc:doc([p(7),{type:'table',content:Array.from({length:65},(_,i)=>row([i%4?cell(2):{type:'tableCell',content:[{type:'paragraph'}]},cell(1)]))},p(5)])},
      {name:'standalone-table',doc:doc([p(8),grid(70),p(4)])},
      {name:'rowspan-multiple-paragraphs',doc:doc([p(9),figure('multi-paragraph',[
        row([header('Satu '),header('Dua '),header('Tiga ')]),
        ...Array.from({length:6},()=>[
          row([{type:'tableCell',attrs:{rowspan:3},content:[p(6),p(5),p(4)]},cell(2),cell(1)]),
          row([cell(4),cell(2)]),row([cell(1,{colspan:2})]),
        ]).flat(),
      ]),p(4)])},
      {name:'forced-breaks-in-table-cells',doc:doc([p(4),figure('cell-breaks',[
        row([header('Satu '),header('Dua ')]),
        ...Array.from({length:14},(_,i)=>row([{type:'tableCell',content:i%4===0?[p(2),{type:'horizontalRule'},p(2)]:[p(2)]},cell(4)])),
      ]),p(4)])},
      {name:'list-table-code-nesting',doc:doc([p(8),{type:'orderedList',attrs:{start:19},content:Array.from({length:2},(_,i)=>({type:'listItem',content:[p(8),table(`list-table-${i}`,12),code(),p(5)]}))},p(4)])},
      {name:'large-images-and-captions',doc:doc([p(12),...Array.from({length:3},(_,i)=>({type:'imageFigure',attrs:{id:`large-${i}`,figureId:`large-${i}`},content:[{type:'image',attrs:{src:'fixture-image',width:1200+i*200}},caption(text(4))]})),p(8)])},
      {name:'unicode-marks-and-hard-breaks',doc:doc(Array.from({length:35},()=>({type:'paragraph',content:[
        {type:'text',text:text(2)+'ÅÉỆgyp e\u0301 👩🏽‍💻 ',marks:[{type:'italic'}]},
        {type:'text',text:text(2),marks:[{type:'bold'}]},
        {type:'hardBreak'},...Array.from({length:3},()=>[{type:'text',text:text(1)},{type:'hardBreak'}]).flat(),
      ]})))},
      {name:'consecutive-and-edge-breaks',doc:doc([{type:'horizontalRule'},...Array.from({length:7},()=>[p(2),{type:'horizontalRule'},{type:'horizontalRule'},p(2)]).flat(),{type:'horizontalRule'}])},
      {name:'multiple-nested-tables-in-cell',doc:doc([p(12),figure('parent-tables',[
        row([header('Gabungan ',{colspan:2})]),row([{type:'tableCell',attrs:{colspan:2},content:[p(12),grid(12),p(12),grid(9),p(4)]}]),
      ]),p(4)])},
    );
    const {buildDocument}=require('./editor-pagination-stress.cjs');
    for(const seed of [13,97,509,65537]) {
      const input=buildDocument(seed,10,citeKey);
      const mark=node=>{
        if(node.type==='text')node.text=node.text.replace(/[^\n]{1,80}/g,part=>`${marker()} ${part}`);
        for(const child of node.content??[])mark(child);
      };
      mark(input);
      fixtures.push({name:`mixed-seed-${seed}`,doc:input});
    }
  }
  // Stable paragraph IDs let the audit reassemble split fragments and detect
  // ordinary text loss even when every coverage marker is still present.
  for(const fixture of fixtures) {
    let block=0;
    const identify=node=>{
      if(node.type==='paragraph'||node.type==='heading')node.attrs={...node.attrs,id:`comparison-block-${++block}`};
      for(const child of node.content??[])identify(child);
    };
    identify(fixture.doc);
  }
  return fixtures;
}

// Runs identically in each surface; expected content comes from the input JSON,
// not the compiler's post-processed HTML. No identical page-break requirement.
function auditSurface(kind, contract) {
  const print = kind === "pagedjs";
  const roots = print ? Array.from(document.querySelectorAll(".pagedjs_page_content")) : [window.editor.view.dom,...document.querySelectorAll('.editor-pagination-furniture')];
  const paper = print ? null : document.querySelector(".page").getBoundingClientRect();
  const geometry = print ? null : window.paginationGeometry();
  const scale = print ? 1 : paper.width/geometry.width;
  const pages = print ? roots.map((root,index)=>({page:index+1,contentBounds:root.getBoundingClientRect()})) : Array.from({length:window.layout().pages},(_,index)=>({page:index+1,contentBounds:{
    top:paper.top+(index*geometry.stride+geometry.margins.top)*scale,
    bottom:paper.top+(index*geometry.stride+geometry.height-geometry.margins.bottom)*scale,
    left:paper.left+geometry.margins.left*scale,right:paper.right-geometry.margins.right*scale,
  }}));
  const metrics=pages.map(({page,contentBounds})=>({page,height:contentBounds.bottom-contentBounds.top,lines:0,minTop:Infinity,maxBottom:-Infinity}));
  const boundsAt=(rect,index)=>print?pages[index]:pages[Math.max(0,Math.floor(((rect.top-paper.top)/scale)/geometry.stride))];
  const clipping=[],atoms=[],markerPages={},markerCounts={};
  let wholeText="";
  const token=/M\d{6}X/g;
  const compact=value=>value.replace(/[\s\u2060\u00ad]/g,"");
  const outside=(rect,bounds)=>rect.top<bounds.top-2*scale||rect.bottom>bounds.bottom+2*scale||rect.left<bounds.left-2*scale||rect.right>bounds.right+2*scale;
  for(let index=0;index<roots.length;index++) {
    const root=roots[index],walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    let node;
    while(node=walker.nextNode()) {
      const parent=node.parentElement;
      if(parent.closest(".katex-mathml,[data-editor-page-break],script,style")||(!print&&parent.closest("button")))continue;
      if(!node.textContent.trim())continue;
      const range=document.createRange();range.selectNodeContents(node);
      const rects=Array.from(range.getClientRects()).filter(rect=>rect.width&&rect.height);
      if(!rects.length)continue;
      wholeText+=node.textContent;
      for(const match of node.textContent.matchAll(token)) {
        const markerRange=document.createRange();markerRange.setStart(node,match.index);markerRange.setEnd(node,match.index+match[0].length);
        const page=boundsAt(markerRange.getBoundingClientRect(),index);
        (markerPages[match[0]]??=[]).push(page?.page??0);
      }
      let suspect=false;
      for(const rect of rects) {
        const page=boundsAt(rect,index);
        if(!page){clipping.push({reason:"beyond last sheet",text:node.textContent.slice(0,50)});continue;}
        const bounds=page.contentBounds,m=metrics[page.page-1];
        if(rect.right>bounds.left&&rect.left<bounds.right&&rect.bottom>bounds.top&&rect.top<bounds.bottom){
          m.lines++;m.minTop=Math.min(m.minTop,Math.max(0,rect.top-bounds.top));m.maxBottom=Math.max(m.maxBottom,Math.min(bounds.bottom,rect.bottom)-bounds.top);
        }
        if(outside(rect,bounds))suspect=true;
      }
      // A Range can include a separate rectangle for a collapsed trailing
      // space outside the line. Confirm overflow with visible characters.
      if(suspect) {
        const seen=new Set();
        for(let offset=0;offset<node.length;offset++) {
          if(/\s/.test(node.textContent[offset]))continue;
          const character=document.createRange();character.setStart(node,offset);character.setEnd(node,offset+1);
          const rect=character.getBoundingClientRect();if(!rect.width||!rect.height)continue;
          const page=boundsAt(rect,index);if(!page)continue;
          const bounds=page.contentBounds;
          if(outside(rect,bounds)&&!seen.has(page.page)) {
            seen.add(page.page);
            clipping.push({page:page.page,text:node.textContent.slice(Math.max(0,offset-12),offset+30),character:node.textContent[offset],top:(rect.top-bounds.top)/scale,bottom:(rect.bottom-bounds.top)/scale,left:(rect.left-bounds.left)/scale,right:(rect.right-bounds.left)/scale});
          }
        }
      }
    }
    for(const element of root.querySelectorAll(print?"img,.katex-display":".node-image img,.node-blockMath")) {
      const rect=element.getBoundingClientRect();if(!rect.height||!rect.width)continue;
      const page=boundsAt(rect,index);const bounds=page?.contentBounds;
      if(!bounds||rect.top<bounds.top-2*scale||rect.bottom>bounds.bottom+2*scale||rect.left<bounds.left-2*scale||rect.right>bounds.right+2*scale)
        atoms.push({page:page?.page,type:element.tagName,top:rect.top-(bounds?.top??0),bottom:rect.bottom-(bounds?.bottom??0)});
    }
  }
  for(const match of compact(wholeText).matchAll(token))markerCounts[match[0]]=(markerCounts[match[0]]??0)+1;
  const literalFailures=[];
  for(const source of contract.literalBlocks) {
    const fragments=roots.flatMap(root=>Array.from(root.querySelectorAll(`[id="${source.id}"],[data-id="${source.id}"]`)));
    const expected=compact(source.text);
    const values=fragments.map(element=>compact(element.textContent));
    const valid=source.repeatable?values.length>0&&values.every(value=>value===expected):values.join('')===expected;
    if(!valid)literalFailures.push({id:source.id,expectedChars:expected.length,actualChars:values.join('').length,fragments:values.length});
  }
  const missing=contract.markers.filter(id=>!markerCounts[id]);
  const duplicated=contract.markers.filter(id=>markerCounts[id]>1&&!contract.repeatable.includes(id));
  const unknown=Object.keys(markerCounts).filter(id=>!contract.markers.includes(id));
  const order=[];
  for(const group of contract.groups) {
    // Check each paragraph's own stream. A multi-column table can legitimately
    // interleave different cells when read page by page.
    const actual=contract.markers.filter(id=>group.markers.includes(id)&&markerCounts[id]);
    if(actual.length!==group.markers.length)continue;
    let previous=-1;
    for(const id of group.markers) {
      const at=compact(wholeText).indexOf(id);
      if(at<previous)order.push({block:group.id,marker:id});
      previous=at;
    }
  }
  const forcedBreaks=contract.forcedBreaks.map(({before,after})=>{
    const a=markerPages[before]?.at(-1),b=markerPages[after]?.[0];
    return {before,after,beforePage:a,afterPage:b,valid:!!a&&!!b&&b>a};
  });
  const headingFailures=contract.headingPairs.flatMap(({heading,following})=>{
    const headingPage=markerPages[heading]?.[0],followingPage=markerPages[following]?.[0];
    return headingPage&&followingPage&&headingPage===followingPage?[]:[{heading,following,headingPage,followingPage}];
  });
  const figureFailures=[];
  for(const source of contract.images) {
    const figures=roots.flatMap(root=>Array.from(root.querySelectorAll('figure[data-type="imageFigure"]'))).filter(figure=>source.captionMarkers.some(id=>compact(figure.querySelector('figcaption')?.textContent??'').includes(id)));
    const image=figures.flatMap(figure=>Array.from(figure.querySelectorAll('img')))[0];
    if(!image||!image.complete||!image.naturalWidth){figureFailures.push({id:source.id,reason:'image missing or not loaded'});continue;}
    const index=print?roots.findIndex(root=>root.contains(image)):0;
    const page=boundsAt(image.getBoundingClientRect(),index)?.page;
    if(!source.captionMarkers.every(id=>(markerPages[id]??[]).length===1&&markerPages[id][0]===page))figureFailures.push({id:source.id,reason:'image and caption are on different pages',page});
  }
  const listLabels=[];
  for(const entry of contract.listItems) {
    let found=false;
    for(const root of roots) {
      const elements=Array.from(root.querySelectorAll('li'));
      const li=elements.filter(el=>compact(el.textContent).includes(entry.marker)).at(-1);
      if(!li)continue;
      const list=li.closest('ol');if(!list)continue;
      // React list node views add wrappers between OL and LI. Use ownership
      // by nearest OL on both surfaces, rather than assuming direct children.
      const siblings=Array.from(list.querySelectorAll('li')).filter(el=>el.closest('ol')===list);
      const value=li.hasAttribute('value')?Number(li.getAttribute('value')):Number(list.getAttribute('start')??1)+siblings.indexOf(li);
      listLabels.push({marker:entry.marker,expected:entry.value,actual:value,valid:value===entry.value});found=true;break;
    }
    if(!found)listLabels.push({marker:entry.marker,expected:entry.value,valid:false,reason:'list marker not found'});
  }
  const headers=[];
  if(print) {
    for(let index=0;index<roots.length;index++)for(const figure of roots[index].querySelectorAll('figure[data-type="figureTable"]')) {
      const caption=figure.querySelector("figcaption"),table=figure.querySelector("table");
      headers.push({page:index+1,id:figure.id||figure.getAttribute("data-id"),caption:caption?.textContent??"",number:caption?.getAttribute("data-numbering"),header:table?.querySelector("thead")?.textContent??""});
    }
    for(let index=0;index<roots.length;index++)for(const table of roots[index].querySelectorAll('table')) {
      if(table.closest('figure[data-type="figureTable"]')?.querySelector('table')===table)continue;
      const header=Array.from(table.querySelectorAll('th')).filter(cell=>cell.closest('table')===table).map(cell=>cell.textContent).join('');
      if(header)headers.push({page:index+1,caption:'',header});
    }
  }else{
    for(const item of window.layout().furniture??[]) {
      const template=document.createElement("div");template.innerHTML=item.html;
      headers.push({page:Math.floor(item.top/geometry.stride)+1,caption:template.querySelector("figcaption")?.textContent??"",number:template.querySelector("figcaption")?.getAttribute("data-label"),header:Array.from(template.querySelectorAll("th"),el=>el.textContent).join("")});
    }
  }
  const tableFailures=[];
  for(const header of headers) {
    const captionMarkers=header.caption.match(token)??[];
    const source=contract.tables.find(item=>item.captionMarkers.some(id=>captionMarkers.includes(id)));
    if(!source) {
      const grid=contract.grids.find(item=>item.headerMarkers.length&&item.headerMarkers.every(id=>compact(header.header).includes(id)));
      if(!header.caption&&grid)continue;
      tableFailures.push({reason:"unmatched caption",...header});continue;
    }
    if(!source.headerMarkers.every(id=>compact(header.header).includes(id)))tableFailures.push({reason:"missing original header",...header});
    if(!source.captionMarkers.every(id=>compact(header.caption).includes(id)))tableFailures.push({reason:"missing original caption",...header});
    if(!header.number)tableFailures.push({reason:"missing table numbering",...header});
    else if(header.number.match(/\d+\.\d+/)?.[0]!==source.number)tableFailures.push({reason:"incorrect table numbering",...header});
  }
  for(const table of contract.tables) {
    const bodyPages=Array.from(new Set(table.bodyMarkers.flatMap(id=>markerPages[id]??[]))).filter(Boolean).sort((a,b)=>a-b);
    for(const page of bodyPages.slice(1)) {
      if(!headers.some(item=>item.page===page&&table.captionMarkers.every(id=>compact(item.caption).includes(id))))
        tableFailures.push({reason:'body continuation without original caption/header',id:table.id,page});
    }
  }
  for(const grid of contract.grids) {
    if(!grid.headerMarkers.length)continue;
    const bodyPages=Array.from(new Set(grid.bodyMarkers.flatMap(id=>markerPages[id]??[]))).filter(Boolean).sort((a,b)=>a-b);
    for(const page of bodyPages.slice(1))if(!headers.some(item=>item.page===page&&grid.headerMarkers.every(id=>compact(item.header).includes(id))))
      tableFailures.push({reason:'standalone/nested table continuation without original header',page,headerMarkers:grid.headerMarkers});
  }
  const labels=Array.from(roots.flatMap(root=>Array.from(root.querySelectorAll('[data-type="ref-component"],a.imagefigure,a.figuretable,a.equation'))),el=>el.textContent.replace(/\s+/g," ").trim());
  const citations=roots.flatMap(root=>Array.from(root.querySelectorAll(print?'a[data-cite]':'cite'),el=>el.textContent.replace(/\s+/g,' ').trim()));
  const variables=roots.flatMap(root=>Array.from(root.querySelectorAll('[data-variable]'),el=>el.textContent.replace(/\s+/g,' ').trim()));
  for(const page of metrics) {
    page.usedFraction=Number.isFinite(page.maxBottom)?Math.min(1,Math.max(0,page.maxBottom/page.height)):0;
    page.blank=!page.lines;delete page.minTop;delete page.maxBottom;
    page.chapterMarkers=Object.values(markerPages).filter(values=>values.includes(page.page)).length;
    page.generatedOnly=print&&page.chapterMarkers===0&&!!roots[page.page-1].querySelector('.static-chapter');
  }
  return {pages:pages.length,chapterPages:metrics.filter(page=>!page.generatedOnly).length,generatedPages:metrics.filter(page=>page.generatedOnly).length,metrics,markerCounts,markerPages,missing,duplicated,unknown,order,literalFailures,figureFailures,headingFailures,clipping,atoms,headers,tableFailures,forcedBreaks,listLabels,referenceLabels:labels,citations,variables};
}

const printHTML=`<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:white"><div id="root"></div><script type="module">
import React,{useEffect,useRef} from 'react';import {createRoot} from 'react-dom/client';
import {PrintStyles} from '/src/components/submission/print-styles.tsx';
import {Engine} from '/src/compiler/engine/index.ts';import BaseHandler from '/src/compiler/handlers/basehandler.ts';import * as Paged from 'pagedjs';
import {Document} from '/src/editor/document/index.ts';import {HighTexDB} from '/src/editor/storage/hightex-db.ts';import {resolveDocumentProfile} from '/src/utils/document-profile.ts';
window.config={get:()=>({language:'en'})};window.hightex={categories:async()=>[{id:1,name:'Fixture',variant:'thesis',chapters:[{chapter:'1',title:'Introduction'}]}]};
window.errors=[];window.addEventListener('error',e=>window.errors.push(e.message));window.addEventListener('unhandledrejection',e=>window.errors.push(String(e.reason)));
Paged.registerHandlers(BaseHandler);
function Print(){const source=useRef(null),render=useRef(null);useEffect(()=>{
 window.compile=async()=>{const start=performance.now();const db=HighTexDB.getInstance();await db.open();
 const before=JSON.stringify((await db.chapters.get('fixture.1')).content);
 const doc=await new Document('fixture').warm({activate:false,workspaceIdentity:false});const chapter=doc.chapters.find(c=>c.getChapter()==='1');
 const inputContent=await chapter.getContent();
 const engine=Engine.getInstance().mount(source.current).withConfig({profile:resolveDocumentProfile(doc.getDocument()),parser:{mode:'single',chapter},paged:{content:source.current.parentElement,renderTo:render.current}});
 await engine.run();window.compilerSource=source.current.innerHTML;await engine.createPaged();if(engine.error)throw engine.error;
 return {ms:performance.now()-start,inputContent,sourceUnchanged:before===JSON.stringify((await db.chapters.get('fixture.1')).content)};};window.ready=true;
},[]);return React.createElement(React.Fragment,null,React.createElement('div',{style:{display:'none'}},React.createElement('section',{className:'content',ref:source})),React.createElement('div',{id:'print-output',ref:render}));}
createRoot(document.getElementById('root')).render(React.createElement(PrintStyles,{onError:e=>window.error=String(e)},React.createElement(Print)));
</script></body></html>`;

function contractFor(doc) {
  let serial=0;
  const markers=[],repeatable=[],groups=[],forcedBreaks=[],tables=[],listItems=[],grids=[],literalBlocks=[],images=[],headingPairs=[];
  const inlineCounts={references:0,citations:0,variables:0};
  const tokens=node=>(JSON.stringify(node).match(/M\d{6}X/g)??[]);
  const walk=(node,repeat=false,parentType)=>{
    if(node.type==='refComponent')inlineCounts.references++;
    if(node.type==='cite')inlineCounts.citations++;
    if(node.type==='variable')inlineCounts.variables++;
    if(node.type==="text") {const values=node.text.match(/M\d{6}X/g)??[];markers.push(...values);if(repeat)repeatable.push(...values);return;}
    if(["paragraph","figcaption","heading","codeBlock"].includes(node.type))groups.push({id:++serial,markers:tokens(node)});
    if(['paragraph','heading'].includes(node.type)&&node.attrs?.id&&node.content?.length&&node.content.every(child=>child.type==='text'||child.type==='hardBreak'))
      literalBlocks.push({id:node.attrs.id,text:node.content.map(child=>child.text??'').join(''),repeatable:repeat});
    if(node.type==='imageFigure')images.push({id:node.attrs.figureId??node.attrs.id,captionMarkers:tokens(node.content.find(child=>child.type==='figcaption'))});
    if(node.type==="figureTable") {
      const caption=node.content.find(child=>child.type==="figcaption"),table=node.content.find(child=>child.type==="table");
      const heads=table.content.filter(row=>row.content.every(cell=>cell.type==="tableHeader"));
      const headerMarkers=tokens(heads);
      tables.push({id:node.attrs.id,number:`1.${tables.length+1}`,captionMarkers:tokens(caption),headerMarkers,bodyMarkers:tokens(table).filter(id=>!headerMarkers.includes(id))});
    }
    if(node.type==='orderedList')node.content.forEach((child,index)=>{
      const first=tokens(child.content[0])[0];if(first)listItems.push({marker:first,value:(node.attrs?.start??1)+index});
    });
    if(node.type==='table'&&parentType!=='figureTable') {
      const headerMarkers=tokens(node.content.filter(row=>row.content.every(cell=>cell.type==='tableHeader')));
      grids.push({headerMarkers,bodyMarkers:tokens(node).filter(id=>!headerMarkers.includes(id))});
    }
    const children=node.content??[];
    for(let i=0;i<children.length;i++) {
      if(children[i].type==='heading'&&children[i+1]?.type!=='horizontalRule') {
        const heading=tokens(children[i]).at(-1),following=children[i+1]&&tokens(children[i+1])[0];
        if(heading&&following)headingPairs.push({heading,following});
      }
      if(children[i].type==="horizontalRule"){
        const before=children.slice(0,i).flatMap(tokens).at(-1),after=children.slice(i+1).flatMap(tokens)[0];
        if(before&&after)forcedBreaks.push({before,after});
      }
      walk(children[i],repeat||node.type==="tableHeader"||(node.type==='figureTable'&&children[i].type==='figcaption'),node.type);
    }
  };
  const flows=[];
  const collectFlow=(node,flow)=>{
    if(node.type==='text'){flow.push(...(node.text.match(/M\d{6}X/g)??[]));return;}
    if(node.type==='figureTable'||node.type==='table') {
      const anchor=tokens(node)[0];if(anchor)flow.push(anchor);
      const table=node.type==='figureTable'?node.content.find(child=>child.type==='table'):node;
      for(const row of table.content)for(const cell of row.content){const child=[];flows.push(child);collectFlow(cell,child)}
      return;
    }
    for(const child of node.content??[])collectFlow(child,flow);
  };
  const main=[];flows.push(main);collectFlow(doc,main);
  walk(doc);
  for(const flow of flows)if(flow.length>1)groups.push({id:`flow-${++serial}`,markers:flow});
  return {markers,repeatable,groups,forcedBreaks,tables,listItems,grids,inlineCounts,literalBlocks,images,headingPairs};
}

function verdict(result) {
  return {
    content:result.missing.length===0&&result.duplicated.length===0&&result.unknown.length===0&&result.order.length===0&&result.literalFailures.length===0,
    figureCaptions:result.figureFailures.length===0,
    headingKeep:result.headingFailures.length===0,
    bounds:result.clipping.length===0&&result.atoms.length===0,
    forcedBreaks:result.forcedBreaks.every(item=>item.valid),
    tableContinuation:result.tableFailures.length===0,
    listNumbering:result.listLabels.every(item=>item.valid),
  };
}

async function runComparison({execute,until,win,artifacts}) {
  const report={createdAt:new Date().toISOString(),platform:process.platform,versions:process.versions,extended:process.env.HIGHTEX_PAGINATION_COMPARE_EXTENDED==='1',cases:[],limitations:[
    "Quality comparison on selected same-input cases; page breaks and page counts need not be identical.",
    "Glyph bounding rectangles approximate painted ink; these tests do not replace visual review.",
    "Compilation/layout wall time is diagnostic, not a comparison of editor typing latency. Generated bibliography pages are reported separately.",
  ]};
  const folder=path.join(artifacts,"comparison");mkdirSync(folder,{recursive:true});
  const call=(window,code)=>window.webContents.executeJavaScript(`(async()=>{${code}})()`);
  const summary=result=>({chapterPages:result.chapterPages,generatedPages:result.generatedPages,missing:result.missing.length,pdfMissing:result.pdfMissing?.length??'n/a',duplicates:result.duplicated.length,literalTextFailures:result.literalFailures.length,figureCaptionFailures:result.figureFailures.length,headingFailures:result.headingFailures.length,clipping:result.clipping.length,atoms:result.atoms.length,tableFailures:result.tableFailures.length,forcedBreaks:result.forcedBreaks.filter(item=>!item.valid).length,listNumbering:result.listLabels.filter(item=>!item.valid).length,blankPages:result.metrics.filter(item=>item.blank).length});
  let printWindow;
  const capture=async(target,pageNumber,file)=>{
    const waitFrames="await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));";
    const sheetRect=`const paper=document.querySelector('.page');const box=paper.getBoundingClientRect();return {x:Math.floor(box.left),y:Math.floor(box.top+${pageNumber-1}*paginationGeometry().stride),width:Math.ceil(box.width),height:Math.ceil(pageMetrics.height)}`;
    // Native capture clips to the viewport. Enlarge only its height until the
    // entire sheet is visible, retaining the layout's measured content width.
    for(let attempt=0;attempt<5;attempt++) {
      await call(target,`const paper=document.querySelector('.page');paper.style.overflowAnchor='none';window.scrollTo({top:scrollY+paper.getBoundingClientRect().top+${pageNumber-1}*paginationGeometry().stride-10,behavior:'instant'});${waitFrames}`);
      const rect=await call(target,sheetRect);
      const viewport=await call(target,'return {width:innerWidth,height:innerHeight}');
      if(rect.y<0)continue;
      if(rect.y+rect.height>viewport.height) {
        target.setContentSize(viewport.width,Math.ceil(rect.y+rect.height+20));
        continue;
      }
      const screenshot=await target.webContents.capturePage(rect);
      const after=await call(target,sheetRect);
      if(Math.abs(after.y-rect.y)>1||Math.abs(after.x-rect.x)>1)continue;
      const size=screenshot.getSize();
      assert.ok(size.width>0&&size.height>0&&Math.abs(size.width/size.height-rect.width/rect.height)<.005,'comparison screenshot omitted part of the sheet');
      writeFileSync(file,screenshot.toPNG());
      return {clip:rect,viewport,pixels:size};
    }
    throw Error('Unable to fit the comparison sheet in the capture viewport');
  };
  const selected=cases(await execute("return window.citeKey")).filter(item=>!process.env.HIGHTEX_PAGINATION_CASE||item.name===process.env.HIGHTEX_PAGINATION_CASE);
  assert.ok(selected.length,"No comparison cases selected");
  const save=()=>{
    writeFileSync(path.join(folder,"report.json"),JSON.stringify(report,null,2));
    const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const cards=report.cases.map(item=>{
      const metrics=item.editor&&item.pagedjs
        ? `<table><tr><th>Metric</th><th>Editor</th><th>Paged.js</th></tr>${Object.keys(summary(item.editor)).map(key=>`<tr><td>${key}</td><td>${summary(item.editor)[key]}</td><td>${summary(item.pagedjs)[key]}</td></tr>`).join('')}</table>`
        : '';
      return `<section><h2>${escape(item.name)}</h2><p>${escape(item.status??item.error??'Running')}</p>
        <p>Editor regressions: ${escape((item.regressions??[]).join(', ')||'none')}. Compiler/Paged.js failures: ${escape((item.baselineFailures??[]).join(', ')||'none')}.</p>
        <p>Same-input SHA-256: <code>${escape(item.inputProof?.editorSha256??'pending')}</code> (${item.inputProof?.matches?'matched':'unverified'}).</p>
        ${metrics}<div class="images">
          <figure><figcaption>Editor, page ${item.editorPreviewPage??1}</figcaption><img src="${item.name}-editor.png"></figure>
          <figure><figcaption>Native compiler PDF, page ${item.printPreviewPage??1}</figcaption><img src="${item.name}-pdf.png"></figure>
        </div><p><a href="${item.name}.json">Detailed audit and reproduction input</a> ·
          <a href="${item.name}-pagedjs.pdf">Native compiler PDF</a> ·
          <a href="${item.name}-pagedjs.txt">Extracted PDF text</a></p></section>`;
    }).join('');
    writeFileSync(path.join(folder,"report.html"),`<!doctype html><meta charset="utf-8"><title>Editor / Paged.js pagination comparison</title>
      <style>body{font:15px system-ui;background:#eef0f3;max-width:1200px;margin:32px auto;padding:20px}section{background:white;margin:24px 0;padding:24px;border-radius:8px}table{border-collapse:collapse;width:100%}td,th{padding:8px;border:1px solid #ddd;text-align:left}.images{display:flex;gap:16px}.images figure{width:50%;margin:12px 0}.images img{width:100%}h1{font-size:24px}code{overflow-wrap:anywhere}</style>
      <h1>Editor pagination compared with production Paged.js</h1>
      <p>Same chapter JSON, production compiler and handlers. Different break positions are allowed. Generated bibliography pages are counted separately. Failures remain visible on both surfaces.</p>
      ${cards}<p>${report.limitations.map(escape).join(' ')}</p>`);
  };
  try {
    win.setSize(1100,1300);
    await execute(`window.compareAudit=${auditSurface.toString()}`);
    for(const fixture of selected) {
      const item={name:fixture.name};report.cases.push(item);
      console.log("START comparison:",fixture.name);
      writeFileSync(path.join(folder,`${fixture.name}.json`),JSON.stringify({input:fixture.doc,status:'started'},null,2));
      try {
        const started=Date.now();
        await execute(`window.setPages(false);window.errors.length=0;const input=${JSON.stringify(fixture.doc)};editor.schema.nodeFromJSON(input).check();await prepareComparison(input);editor.commands.setContent(input);await waitSaved();await document.fonts.ready`);
        await until("Array.from(editor.view.dom.querySelectorAll('img')).every(image=>image.complete)");
        await execute("window.compareInput=editor.getJSON();await db.chapters.put({id:'fixture.1',content:compareInput.content});window.setPages(true)");
        await until("layoutReady()&&!document.querySelector('[data-pagination-measure]')&&document.fonts.status!=='loading'");
        assert.equal(await execute("return Boolean(layout().error)"),false,"editor layout failed");
        const input=await execute("return window.compareInput");
        if(fixture.name==='standalone-without-table-header')assert.ok(input.content.find(node=>node.type==='table').content.every(row=>row.content.every(cell=>cell.type==='tableCell')),'headerless fixture was normalized into a header table');
        const contract=contractFor(input);
        assert.ok(contract.markers.length>10,"comparison has insufficient content coverage markers");
        item.editor=await execute(`return compareAudit('editor',${JSON.stringify(contract)})`);
        item.editorMs=Date.now()-started;
        item.editorUnchanged=await execute("return JSON.stringify(editor.getJSON())===JSON.stringify(compareInput)");
        item.editorErrors=await execute("return window.errors");
        printWindow=new BrowserWindow({show:false,width:1100,height:1300,webPreferences:{backgroundThrottling:false}});
        printWindow.webContents.on("console-message",event=>{if(event.level==="error")console.error("Paged.js:",event.message)});
        const url=new URL(win.webContents.getURL());url.pathname="/comparison-print.html";
        await printWindow.loadURL(url.href);
        const readyDeadline=Date.now()+20000;
        while(!await call(printWindow,"return Boolean(window.ready||window.error)")){
          if(Date.now()>readyDeadline)throw Error("Print fixture did not initialize");
          await new Promise(resolve=>setTimeout(resolve,40));
        }
        assert.equal(await call(printWindow,"return window.error??null"),null);
        let timeout;
        try {
          item.compiler=await Promise.race([call(printWindow,"return window.compile()"),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Production compiler exceeded 45 seconds')),45000)})]);
        }finally{clearTimeout(timeout)}
        const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
        item.inputProof={editorSha256:digest(input),compilerSha256:digest({type:'doc',content:item.compiler.inputContent})};
        delete item.compiler.inputContent;
        item.inputProof.matches=item.inputProof.editorSha256===item.inputProof.compilerSha256;
        assert.ok(item.inputProof.matches,'editor and compiler consumed different chapter JSON');
        item.pagedjs=await call(printWindow,`return (${auditSurface.toString()})('pagedjs',${JSON.stringify(contract)})`);
        item.printErrors=await call(printWindow,"return window.errors");
        item.compilerSourceMissing=await call(printWindow,`const template=document.createElement('div');template.innerHTML=compilerSource;const text=template.textContent.replace(/\\s/g,'');return ${JSON.stringify(contract.markers)}.filter(marker=>!text.includes(marker))`);
        const pdfPath=path.join(folder,`${fixture.name}-pagedjs.pdf`);
        writeFileSync(pdfPath,await printWindow.webContents.printToPDF({printBackground:true,preferCSSPageSize:true}));
        try {
          const extracted=execFileSync('pdftotext',['-layout',pdfPath,'-'],{encoding:'utf8',timeout:10000});
          writeFileSync(path.join(folder,`${fixture.name}-pagedjs.txt`),extracted);
          const compact=extracted.replace(/\s/g,'');
          item.pagedjs.pdfMissing=contract.markers.filter(marker=>!compact.includes(marker));
        }catch(error){item.pdfExtractionError=String(error)}
        const brokenBreak=item.pagedjs.forcedBreaks.find(entry=>!entry.valid);
        const problemMarker=item.pagedjs.pdfMissing?.[0]??brokenBreak?.after??item.pagedjs.headingFailures[0]?.heading??item.editor.headingFailures[0]?.heading??item.pagedjs.clipping[0]?.text.match(/M\d{6}X/)?.[0];
        item.previewMarker=problemMarker;
        item.editorPreviewPage=item.editor.markerPages[problemMarker]?.[0]??item.editor.clipping[0]?.page??Math.min(2,item.editor.pages);
        item.printPreviewPage=item.pagedjs.markerPages[problemMarker]?.[0]??item.pagedjs.clipping[0]?.page??brokenBreak?.afterPage??Math.min(2,item.pagedjs.chapterPages);
        // Compare the editor against the actual PDF page, avoiding screen-only
        // Paged.js styles. Show the same source marker where possible.
        item.editorScreenshot=await capture(win,item.editorPreviewPage,path.join(folder,`${fixture.name}-editor.png`));
        execFileSync('pdftoppm',['-f',String(item.printPreviewPage),'-singlefile','-scale-to','1600','-png',pdfPath,path.join(folder,`${fixture.name}-pdf`)],{timeout:10000});
        item.editorChecks=verdict(item.editor);item.pagedjsChecks=verdict(item.pagedjs);
        if(item.pagedjs.pdfMissing?.length)item.pagedjsChecks.content=false;
        item.referenceMatch=JSON.stringify(item.editor.referenceLabels)===JSON.stringify(item.pagedjs.referenceLabels);
        for(const [key,field] of [['references','referenceLabels'],['citations','citations'],['variables','variables']]) {
          const editorValues=item.editor[field],printValues=item.pagedjs[field];
          const same=JSON.stringify(editorValues)===JSON.stringify(printValues);
          item.editorChecks[key]=same&&editorValues.length===contract.inlineCounts[key];
          item.pagedjsChecks[key]=printValues.length===contract.inlineCounts[key];
        }
        item.regressions=Object.keys(item.editorChecks).filter(key=>!item.editorChecks[key]&&item.pagedjsChecks[key]);
        item.baselineFailures=Object.keys(item.pagedjsChecks).filter(key=>!item.pagedjsChecks[key]);
        item.sharedFailures=Object.keys(item.editorChecks).filter(key=>!item.editorChecks[key]&&!item.pagedjsChecks[key]);
        item.improvements=Object.keys(item.editorChecks).filter(key=>item.editorChecks[key]&&!item.pagedjsChecks[key]);
        item.status=item.regressions.length?"EDITOR REGRESSION":item.sharedFailures.length?"BOTH REQUIRE REVIEW":"EDITOR CHECKS PASS";
        console.log("COMPARE",fixture.name,JSON.stringify({status:item.status,editor:summary(item.editor),pagedjs:summary(item.pagedjs),regressions:item.regressions,sharedFailures:item.sharedFailures,improvements:item.improvements}));
        writeFileSync(path.join(folder,`${fixture.name}.json`),JSON.stringify({input,contract,...item},null,2));
        if(fixture.name==='paragraphs-and-headings') {
          item.oracleChecks=await call(printWindow,`const audit=${auditSurface.toString()};const contract=${JSON.stringify(contract)};
            const marker=contract.markers[0],root=document.querySelector('.pagedjs_page_content');
            const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
            while(node=walker.nextNode())if(node.textContent.includes(marker))break;
            if(!node)throw Error('Missing oracle target');
            const original=node.textContent,style=node.parentElement.getAttribute('style');
            node.textContent=original.replace(marker,'');const missing=audit('pagedjs',contract).missing.includes(marker);node.textContent=original;
            node.textContent=original+' '+marker;const duplicate=audit('pagedjs',contract).duplicated.includes(marker);node.textContent=original;
            node.textContent=original.replace('Penelitian','Penelitia');const literalText=audit('pagedjs',contract).literalFailures.length>0;node.textContent=original;
            node.parentElement.style.transform='translateY(2000px)';const clipping=audit('pagedjs',contract).clipping.length>0;
            if(style===null)node.parentElement.removeAttribute('style');else node.parentElement.setAttribute('style',style);
            const forced=audit('pagedjs',{...contract,forcedBreaks:[{before:contract.markers[0],after:contract.markers[1]}]}).forcedBreaks[0].valid===false;
            return {missing,duplicate,literalText,clipping,forced};`);
          assert.ok(Object.values(item.oracleChecks).every(Boolean),'comparison oracle failed to detect deliberately broken output');
          console.log('PASS: negative oracle checks',JSON.stringify(item.oracleChecks));
        }
        if(fixture.name==='merged-headers-and-long-cell') {
          item.furnitureOracle=await execute(`const furniture=document.querySelector('.editor-pagination-furniture');
            const style=furniture.getAttribute('style');furniture.style.transform='translateX(2000px)';
            const detected=compareAudit('editor',${JSON.stringify(contract)}).clipping.length>0;
            furniture.setAttribute('style',style);return detected;`);
          assert.equal(item.furnitureOracle,true,'audit ignored overflow in repeated table furniture');
          console.log('PASS: repeated table furniture negative oracle');
        }
        writeFileSync(path.join(folder,`${fixture.name}.json`),JSON.stringify({input,contract,...item},null,2));
      } catch(error) {
        item.error=String(error);item.status="COMPARISON ERROR";console.error("FAIL comparison:",fixture.name,item.error);
        item.failureState=await execute('return {doc:editor.getJSON(),layout:layout(),errors:window.errors}').catch(()=>null);
        if(!win.isDestroyed()&&!win.webContents.isCrashed())writeFileSync(path.join(folder,`${fixture.name}-failure.png`),(await win.webContents.capturePage()).toPNG());
        writeFileSync(path.join(folder,`${fixture.name}.json`),JSON.stringify({input:fixture.doc,...item},null,2));
      } finally {
        if(printWindow&&!printWindow.isDestroyed())printWindow.destroy();printWindow=null;save();
      }
    }
  }finally{
    if(printWindow&&!printWindow.isDestroyed())printWindow.destroy();save();
    console.log("Comparison report:",path.join(folder,"report.html"));
  }
  assert.equal(report.cases.filter(item=>item.error||item.regressions?.length||item.sharedFailures?.length||!item.editorUnchanged||!item.compiler?.sourceUnchanged||item.printErrors?.length||item.editorErrors?.length||item.pdfExtractionError).length,0,"Comparison found quality failures; inspect report.html");
  console.log(`PASS: ${report.cases.length} same-input editor quality comparisons; ${report.cases.filter(item=>item.baselineFailures?.length).length} compiler/Paged.js cases require review.`);
}

module.exports={printHTML,runComparison};
if(process.argv[1]&&path.resolve(process.argv[1])===__filename){process.env.HIGHTEX_PAGINATION_COMPARE="1";require("./editor-pagination.cjs")}
