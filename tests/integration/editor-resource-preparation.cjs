const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
exports.run = async ({execute,artifacts}) => {
  const report=await execute(`
    setPages(false);await waitSaved();
    const {DocumentResources}=await import('/src/document-engine/resources/document-resources.ts');
    const root=document.createElement('div');document.body.append(root);
    const expected='data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>');
    let active=0,maxActive=0,reads=0;
    class Assets extends DocumentResources {
      async data(){reads++;active++;maxActive=Math.max(maxActive,active);await new Promise(resolve=>setTimeout(resolve,15));active--;return expected;}
    }
    for(let index=0;index<12;index++){const image=document.createElement('img');image.src=expected;root.append(image)}
    let assignments=0;
    const sourceProperty=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
    for(const image of root.querySelectorAll('img'))Object.defineProperty(image,'src',{
      get(){return sourceProperty.get.call(this)},set(value){assignments++;sourceProperty.set.call(this,value)},
    });
    const resources=new Assets(new AbortController().signal);
    const before=performance.now();
    for(const image of root.querySelectorAll('img'))image.src=await resources.data(image.src);
    const serialMs=performance.now()-before;reads=0;maxActive=0;assignments=0;
    const start=performance.now();await resources.prepare(root);const parallelMs=performance.now()-start;
    const same=Array.from(root.querySelectorAll('img')).every(image=>image.src===expected&&image.naturalWidth===10);
    root.remove();
    const actual=new DocumentResources(new AbortController().signal);
    const digest=crypto.subtle.digest.bind(crypto.subtle);let digests=0;
    crypto.subtle.digest=(...args)=>{digests++;return digest(...args)};
    try{
      const first=await actual.layoutFingerprint();const beforeRepeat=digests;
      const start=performance.now();const repeat=await Promise.all([actual.layoutFingerprint(),actual.layoutFingerprint()]);
      const repeatMs=performance.now()-start,reused=digests===beforeRepeat;
      const style=document.createElement('style');style.textContent='.resource-fingerprint-probe{padding:1px}';document.head.append(style);
      let changed;try{changed=await actual.layoutFingerprint()!==first}finally{style.remove()}
      return {reads,maxActive,assignments,same,serialMs,parallelMs,fingerprint:{reused,same:repeat.every(value=>value===first),changed,repeatMs}};
    }finally{crypto.subtle.digest=digest}
  `);
  fs.writeFileSync(path.join(artifacts,'resource-preparation.json'),JSON.stringify(report,null,2));
  assert.equal(report.reads,12);assert.equal(report.assignments,0);assert.equal(report.maxActive,4);assert.equal(report.same,true);
  assert.equal(report.fingerprint.reused,true);assert.equal(report.fingerprint.same,true);assert.equal(report.fingerprint.changed,true);
  console.log('PASS resource preparation:',artifacts,JSON.stringify(report));
};
