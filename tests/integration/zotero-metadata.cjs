// Actual import dialog/search/storage with an incomplete Zotero listing; isolated fixture bridge.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
exports.run=async({execute,until,win,artifacts,errors})=>{
  console.log('Zotero metadata artifacts:',artifacts);
  await until('window.ready');
  await execute(`(async()=>{
    const {parseZoteroItems}=await import('/electron/utilities/zotero.ts');
    const payload=[
      {data:{key:'UNTITLED',itemType:'book',creators:[null,{creatorType:'author',name:'Institute'}],date:'2026'}},
      {data:{key:'NAMED',title:'Named publication',itemType:'journalArticle',date:'2025'}},
      {data:{key:'NOTE',itemType:'note',note:'Not a publication'}},
      {data:{key:'FILE',itemType:'attachment'}},
      {data:{key:'ANNOTATION',itemType:'annotation'}},
      {data:{title:'Missing key'}},
    ];
    window.zoteroExports=[];
    window.zotero={
      testConnection:async(host,port)=>({connected:true,host,port,message:'Fixture API connected'}),
      listItems:async()=>parseZoteroItems(payload),
      searchItems:async(_host,_port,query)=>parseZoteroItems(payload).filter(item=>(item.title+' '+item.key).toLowerCase().includes(query.toLowerCase())),
      exportBibtex:async(_host,_port,key)=>{zoteroExports.push(key);return '@book{metadata-recovered,title={Recovered publication},author={Writer, Alice},year={2026}}'},
    };
    window.config.get().zotero.enabled=true;show('library');
  })()`);
  const click=label=>execute(`[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===${JSON.stringify(label)}).click()`);
  await until("document.querySelector('[data-tour=reference-zotero]')&&!document.querySelector('[data-tour=reference-zotero]').disabled");
  await execute("document.querySelector('[data-tour=reference-zotero]').click()");
  await until("document.querySelector('[role=dialog]')?.textContent.includes('Named publication')");
  assert.equal(await execute("document.querySelectorAll('[role=dialog] [role=checkbox]').length"),2);
  assert(await execute("Boolean(document.querySelector('[role=checkbox][aria-label=UNTITLED]'))"));
  assert(!await execute("document.querySelector('[role=dialog]').textContent.includes('Missing key')"));
  await execute(`(()=>{const input=document.querySelector('[role=dialog] input[type=search]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'UNTITLED');input.dispatchEvent(new Event('input',{bubbles:true}))})()`);
  await until("document.querySelectorAll('[role=dialog] [role=checkbox]').length===1");
  await execute("document.querySelector('[role=checkbox][aria-label=UNTITLED]').click()");
  await until("[...document.querySelectorAll('button')].some(button=>button.textContent.trim()==='Impor yang Dipilih'&&!button.disabled)");
  await execute('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  fs.writeFileSync(path.join(artifacts,'zotero-missing-title.png'),(await win.webContents.capturePage()).toPNG());
  await click('Impor yang Dipilih');
  await until("!document.querySelector('[role=dialog]')&&document.querySelector('[data-citation-key=metadata-recovered]')");
  assert.deepEqual(await execute('zoteroExports'),['UNTITLED']);
  assert.equal(await execute('db.cite.count()'),4);
  assert((await execute("db.cite.get('metadata-recovered').then(record=>record.bib)")).includes('Recovered publication'));
  assert.equal(await execute('db.chapters.toArray().then(rows=>JSON.stringify(rows))'),await execute('storedBefore'));
  assert.deepEqual(errors,[]);
  const report={complete:true,missingTitleItemVisible:true,searchByKey:true,childAndMissingKeyItemsExcluded:true,exportedKeys:['UNTITLED'],referencePersisted:true,sourceUnchanged:true,errors,scope:'macOS native UI; Zotero HTTP adapter covered by unit fixtures; mocked bridge, no real Zotero/Windows runner'};
  fs.writeFileSync(path.join(artifacts,'zotero-metadata.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({result:'PASS',...report,artifacts}));
};
if(process.argv[1]&&path.resolve(process.argv[1])===__filename){process.env.HIGHTEX_ZOTERO_METADATA='1';require('./reference-usage-list.cjs')}
