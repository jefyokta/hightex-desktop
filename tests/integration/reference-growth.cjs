// Bounded native regression for large reference catalogs and safe cleanup of prior import duplicates.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
exports.run=async({execute,until,win,artifacts,errors,key})=>{
  console.log('Reference growth artifacts:',artifacts);
  await until('window.ready');
  await execute(`(async()=>{
    window.editor.has=async()=>false;
    await db.cite.bulkPut(Array.from({length:2000},(_,index)=>({key:'legacy-'+String(index).padStart(4,'0'),documentId:'a',bib:'@book{old,title={Old duplicate},author={Writer, Alice},year={2026}}'})));
    await db.cite.bulkPut(['recovery-protected','version-protected'].map(key=>({key,bib:'@book{'+key+',title={Protected publication},author={Writer, Alice},year={2026}}'})));
    await db.documents.put({id:'recovered',title:'Recovery document',recovery:{sourceDocumentId:'a',sourceTitle:'Thesis A',createdAt:1,revision:'fixture'}});
    await db.chapters.bulkPut([
      {id:'recovered.1',content:[{type:'paragraph',content:[{type:'cite',attrs:{cite:'recovery-protected'}}]}]},
      {id:'b.1.v1',content:[{type:'paragraph',content:[{type:'cite',attrs:{cite:'version-protected'}}]}]},
    ]);
    window.growthBefore=JSON.stringify(await db.chapters.toArray());show('library');
  })()`);
  const rows='document.querySelectorAll("[data-citation-key]")';
  const click=label=>execute(`[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===${JSON.stringify(label)}).click()`);
  const search=value=>execute(`(()=>{const input=document.querySelector('input[type=search]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}))})()`);
  await until(`${rows}.length===50&&document.body.innerText.includes('dari 2005 sitasi')`);
  const first=await execute(`[...${rows}].map(node=>node.dataset.citationKey)`);
  await click('Berikutnya');
  await until(`document.body.innerText.includes('51–100 dari 2005 sitasi')`);
  const next=await execute(`[...${rows}].map(node=>node.dataset.citationKey)`);
  assert.equal(next.length,50);assert(next.every(item=>!first.includes(item)));
  await search('legacy-1999');
  await until(`${rows}.length===1&&document.querySelector('[data-citation-key="legacy-1999"]')`);
  fs.writeFileSync(path.join(artifacts,'last-reference-search.png'),(await win.webContents.capturePage()).toPNG());
  await execute("show('editor')");
  await until(`${rows}.length===50&&document.body.innerText.includes('dari 2005 sitasi')`);
  await click('Berikutnya');await until(`document.body.innerText.includes('51–100 dari 2005 sitasi')`);
  assert.equal(await execute(`${rows}.length`),50);
  await execute("show('library')");
  await until(`${rows}.length===50&&document.body.innerText.includes('dari 2005 sitasi')`);
  await click('Hapus sitasi tak terpakai');
  await until("document.querySelector('[role=dialog]')?.textContent.includes('2001')");
  assert.equal(await execute('db.cite.count()'),2005);
  await click('Batal');await until("!document.querySelector('[role=dialog]')");
  assert.equal(await execute('db.cite.count()'),2005);
  await click('Hapus sitasi tak terpakai');
  await until("document.querySelector('[role=dialog]')?.textContent.includes('2001')");
  await click('Hapus 2001 sitasi');
  await until(`${rows}.length===4`);
  await until("!document.querySelector('[role=dialog]')");
  assert.deepEqual((await execute('db.cite.toCollection().primaryKeys()')).sort(),[key,'other','recovery-protected','version-protected'].sort());
  assert.equal(await execute('db.chapters.toArray().then(rows=>JSON.stringify(rows))'),await execute('growthBefore'));
  assert.deepEqual(errors,[]);
  const report={complete:true,initialReferences:2005,maxRenderedRows:50,searchFindsLastReference:true,cleanupCancelledWithoutWrites:true,deletedUnused:2001,remainingUsed:4,recoveryAndHistoricalReferencesProtected:true,sourceUnchanged:true,errors};
  fs.writeFileSync(path.join(artifacts,'reference-growth.json'),JSON.stringify(report,null,2));
  fs.writeFileSync(path.join(artifacts,'cleanup-complete.png'),(await win.webContents.capturePage()).toPNG());
  console.log(JSON.stringify({result:'PASS',...report,artifacts}));
};
if(process.argv[1]&&path.resolve(process.argv[1])===__filename){process.env.HIGHTEX_REFERENCE_GROWTH='1';require('./reference-usage-list.cjs')}
