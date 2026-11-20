const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

exports.run = async ({execute,artifacts}) => {
  const report=await execute(`
    const {DocumentResources}=await import('/src/document-engine/resources/document-resources.ts');
    await waitSaved();setPages(false);await new Promise(requestAnimationFrame);
    const results=[];
    for(let round=0;round<3;round++){
      const resources=new DocumentResources(new AbortController().signal);
      const start=performance.now(),first=await resources.styles(),captured=performance.now();
      const second=await resources.styles(),done=performance.now();
      results.push({firstMs:captured-start,repeatMs:done-captured,bytes:first.length,same:first===second});
    }
    const resources=new DocumentResources(new AbortController().signal);
    const parallel=await Promise.all([resources.styles(),resources.styles(),resources.styles()]);
    const concurrent=parallel.every(css=>css===parallel[0]&&!css.includes('undefined'));
    const style=document.createElement('style');style.textContent='.resource-revision-probe{color:rgb(12,34,56)}';document.head.append(style);
    let changed,guard=false;
    try{
      try{resources.assertCurrent()}catch{guard=true}
      changed=(await resources.styles()).includes('resource-revision-probe');
      style.sheet.insertRule('.resource-rule-edit{color:green}');
      changed=changed&&(await resources.styles()).includes('resource-rule-edit');
    }finally{style.remove()}
    return {results,changed,guard,concurrent};
  `);
  fs.writeFileSync(path.join(artifacts,'resource-performance.json'),JSON.stringify(report,null,2));
  assert.ok(report.results.every(result=>result.same));assert.equal(report.changed,true);assert.equal(report.guard,true);
  assert.equal(report.concurrent,true);
  console.log('Resource performance:',artifacts,JSON.stringify(report));
};
