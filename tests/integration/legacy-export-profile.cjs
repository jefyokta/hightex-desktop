// Opt-in legacy service comparison. No legacy application implementation is patched.
const fs = require('node:fs');
const path = require('node:path');
const electron = require('electron');
const {PDFDocument} = require('pdf-lib');


exports.prepare=({root,artifacts,load,dependencies})=>{
  let input,base;
  const preload=path.join(artifacts,'legacy-profile-preload.cjs');
  fs.writeFileSync(preload,`const {contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('legacyFixture',{input:()=>ipcRenderer.invoke('fixture:legacy:input'),send:(channel,payload)=>ipcRenderer.send(channel,payload)});`);
  electron.ipcMain.handle('fixture:legacy:input',()=>input);
  const {PDFService}=load('electron/service/pdf-service.ts',{
    ...dependencies,
    '../main/application':{Application:{instance:{preloadEntry:preload,resolveRendererUrl:route=>new URL(route,base).href}}},
    './logger-service':{LoggerService:{writeAsync:async()=>{}}},
    '@main/exception/export-timeout':{ExportTimeout:class extends Error{constructor(){super('Legacy profile deadline')}}},
    '../windows/editor-window':{EditorWindow:{flush:async()=>{}}},
  });
  return {
    async generate(url,data){
      base=url;input=data;
      const service=new PDFService(),timings={nativePrintMs:[],payloadReadyMs:0,renderer:null};
      const create=service.createWindow.bind(service),started=performance.now();
      service.createWindow=()=>{
        const win=create(),print=win.webContents.printToPDF.bind(win.webContents);
        win.webContents.printToPDF=async options=>{
          timings.payloadReadyMs=performance.now()-started;
          timings.renderer=await win.webContents.executeJavaScript('window.legacyTimings');
          const before=performance.now();try{return await print(options)}finally{timings.nativePrintMs.push(performance.now()-before)}
        };
        return win;
      };
      const bytes=await service.generate(data.id);
      const file=path.join(artifacts,'legacy-profile.pdf');fs.writeFileSync(file,bytes);
      const pdf=await PDFDocument.load(bytes);
      const result={ms:performance.now()-started,pages:pdf.getPageCount(),bytes:bytes.length,calls:timings.nativePrintMs.length,...timings};
      fs.writeFileSync(path.join(artifacts,'legacy-export-profile.json'),JSON.stringify(result,null,2));
      return result;
    },
    async serve(req,res,vite){
      if(!/^\/document\/[^/]+\/print(?:\/true)?$/.test(new URL(req.url,'http://fixture').pathname))return false;
      res.setHeader('content-type','text/html');
      res.end(await vite.transformIndexHtml('/legacy-profile.html',exports.html));return true;
    },
  };
};
exports.html=`<!doctype html><html><body style="margin:0;background:white"><div id="root"></div><script type="module">
import React from 'react';import {createRoot} from 'react-dom/client';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
import {HighTexDB} from '/src/editor/storage/hightex-db.ts';
import {Document} from '/src/editor/document/index.ts';
import {resolveWorkspaceDocumentProfile} from '/src/utils/document-profile.ts';
import {PrintableContextProvider} from '/src/hooks/use-printable.tsx';
import {PrintStyles} from '/src/components/submission/print-styles.tsx';
import {FullDocument} from '/src/components/printable/index.tsx';
import {Engine} from '/src/compiler/engine/index.ts';
import BaseHandler from '/src/compiler/handlers/basehandler.ts';import * as Paged from 'pagedjs';
Paged.registerHandlers(BaseHandler);
window.ipcRenderer={send:(channel,payload)=>legacyFixture.send(channel,payload)};
const input=await legacyFixture.input();
window.config={get:()=>input.config};
window.hightex={categories:async()=>input.categories,cloud:{academic:{locked:async()=>false}}};
window.profile={get:async()=>input.profile,picture:async()=>input.picture};
window.legacyTimings={};
for(const name of ['run','createPaged']){
 const original=Engine.prototype[name];Engine.prototype[name]=async function(...args){const start=performance.now();try{return await original.apply(this,args)}finally{legacyTimings[name]=performance.now()-start}};
}
const start=performance.now();
try{
 await HighTexDB.getInstance().open();
 const doc=await new Document(input.id).warm({activate:false,workspaceIdentity:false});doc.activate();
 const profile=await resolveWorkspaceDocumentProfile(doc.getDocument());
 legacyTimings.sourceMs=performance.now()-start;
 const onError=error=>legacyFixture.send('page:error:'+input.id+':'+new URLSearchParams(location.search).get('printRequest'),String(error));
 createRoot(document.getElementById('root')).render(
  React.createElement(MemoryRouter,{initialEntries:[location.pathname+location.search]},
   React.createElement(Routes,null,React.createElement(Route,{path:'/document/:id/print',element:
    React.createElement(PrintableContextProvider,{value:{document:doc,profile,ready:true,pageMode:'full',inFrame:false}},
     React.createElement(PrintStyles,{onError},React.createElement(FullDocument)))}))));
}catch(error){legacyFixture.send('page:error:'+input.id+':'+new URLSearchParams(location.search).get('printRequest'),error.stack||String(error))}
</script></body></html>`;
