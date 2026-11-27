const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
exports.html=`<!doctype html><html><body style="padding:12px"><div id="root"></div><script type="module">
import React from 'react';import{createRoot}from'react-dom/client';import{MemoryRouter}from'react-router-dom';
import{useIPC}from'/src/hooks/use-ipc.ts';
import{ConfigContextProvider}from'/src/context/config-context.tsx';
import{ConfirmProvider}from'/src/context/confrim-context.tsx';
import{MultiSelectProvider}from'/src/context/multi-select-context.tsx';
import{Citation}from'/src/pages/citation.tsx';
import{HighTexDB}from'/src/editor/storage/hightex-db.ts';
import{ReferenceRepository}from'/src/editor/storage/reference-repository.ts';
import{getWorkspaceAuthorProfile}from'/src/utils/document-profile.ts';
import{Manager}from'/src/editor/manager/index.ts';
import'/src/App.css';
const root=createRoot(document.getElementById('root'));
root.render(React.createElement(ConfigContextProvider,null,React.createElement(MemoryRouter,null,
 React.createElement(ConfirmProvider,null,React.createElement(MultiSelectProvider,null,React.createElement(Citation))))));
window.frameIPC=useIPC;window.frameDB=HighTexDB.getInstance();window.frameRepository=new ReferenceRepository();
window.frameProfile=getWorkspaceAuthorProfile;window.frameManager=Manager;window.frameUnmount=()=>root.unmount();window.frameReady=true;
</script></body></html>`;
exports.run=async({execute,until,win,artifacts,errors})=>{
  console.log('IPC frame artifacts:',artifacts);
  await until('window.ready');
  await execute(`(async()=>{
    const {parseZoteroItems}=await import('/electron/utilities/zotero.ts');
    window.frameCalls=[];window.frameErrorListeners=new Set();window.frameProfileListeners=new Set();window.profileReads=0;
    window.ipcRenderer={on:(type,callback)=>frameErrorListeners.add(callback),off:(type,callback)=>frameErrorListeners.delete(callback)};
    window.profile={get:async()=>{profileReads++;return {name:'Parent author',nim:'123',advisorName:'Advisor',advisorNip:'456',cv:''}},picture:async()=>false,onChange:callback=>{frameProfileListeners.add(callback);return()=>frameProfileListeners.delete(callback)}};
    window.editor.has=async id=>{frameCalls.push('has:'+id);return false};
    window.zotero={testConnection:async()=>({connected:true,host:'localhost',port:23119,message:'fixture'}),
      listItems:async()=>{frameCalls.push('list');return parseZoteroItems([{data:{key:'FRAMEBOOK',itemType:'book',date:'2026'}}])},
      searchItems:async()=>[],exportBibtex:async(_host,_port,key)=>{frameCalls.push('export:'+key);return '@book{frame-book,title={Frame import},author={Writer},year={2026}}'}};
    window.config.get().zotero.enabled=true;
    window.hostHightex=window.hightex;window.testFrame=document.createElement('iframe');testFrame.src='/ipc-frame';
    testFrame.style='width:100%;height:850px;border:0';document.getElementById('root').style.display='none';document.body.append(testFrame);
  })()`);
  const child=code=>execute(`testFrame.contentWindow.eval(${JSON.stringify(code)})`);
  const childUntil=code=>until(`testFrame.contentWindow.eval(${JSON.stringify(`Boolean(${code})`)})`);
  await childUntil("window.frameReady&&document.querySelector('[data-tour=reference-zotero]')&&!document.querySelector('[data-tour=reference-zotero]').disabled");
  assert.equal(await child('typeof window.zotero'),'undefined');
  assert.equal(await child('typeof window.config'),'undefined');
  await child("document.querySelector('[data-tour=reference-zotero]').click()");
  await childUntil("document.querySelector('[role=checkbox][aria-label=FRAMEBOOK]')");
  await child("document.querySelector('[role=checkbox][aria-label=FRAMEBOOK]').click()");
  await childUntil("[...document.querySelectorAll('button')].some(button=>button.textContent.trim()==='Impor yang Dipilih'&&!button.disabled)");
  await child("[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Impor yang Dipilih').click()");
  await childUntil("!document.querySelector('[role=dialog]')&&document.querySelector('[data-citation-key=frame-book]')");
  const usage=await child("frameRepository.usage('other')");assert.equal(usage[0].documentId,'a');
  const profiles=await child('Promise.all([frameProfile(),frameProfile()])');assert.equal(profiles[0].name,'Parent author');
  assert.equal(await execute('profileReads'),1);assert.equal(await execute('frameProfileListeners.size'),1);
  await child(`window.removeMainErrors=frameManager.app.onError(()=>{});window.hightex={categories:async()=>[]};window.ipcRenderer={off:()=>{throw Error('Wrong IPC listener owner')}};void 0`);
  assert.equal(await execute('frameErrorListeners.size'),1);
  assert.equal(await child('frameIPC("hightex")===window'),true);
  assert.equal(await execute('window.hightex===hostHightex'),true);
  await child('removeMainErrors()');assert.equal(await execute('frameErrorListeners.size'),0);
  assert.equal(await execute('db.cite.count()'),4);
  assert.equal(await execute('db.chapters.toArray().then(rows=>JSON.stringify(rows))'),await execute('storedBefore'));
  await child('window.dispatchEvent(new Event("pagehide"));frameUnmount()');
  assert.equal(await execute('frameProfileListeners.size'),0);
  await execute("testFrame.remove();document.getElementById('root').style.display=''");
  assert.deepEqual(errors,[]);
  const report={complete:true,frameHasNoPreload:true,parentZoteroImport:true,nonReactUsageUsesParent:true,localSnapshotAdapterPreserved:true,hostUnchanged:true,profileReads:1,profileListenersDisposed:true,errorListenerOwnerPreserved:true,sourceUnchanged:true,calls:await execute('frameCalls'),errors};
  fs.writeFileSync(path.join(artifacts,'ipc-frames.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({result:'PASS',...report,artifacts}));
};
if(process.argv[1]&&path.resolve(process.argv[1])===__filename){process.env.HIGHTEX_IPC_FRAMES='1';require('./reference-usage-list.cjs')}
