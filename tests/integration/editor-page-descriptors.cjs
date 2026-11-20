const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

exports.run = async ({execute,artifacts}) => {
  const report=await execute(`
    setPages(false);await waitSaved();
    const {chapterPages}=await import('/src/document-engine/renderers/chapter-pages.ts');
    const {paginationGeometry}=await import('/src/editor/pagination/options.ts');
    const {DocumentResources}=await import('/src/document-engine/resources/document-resources.ts');
    const geometry=paginationGeometry(),paper=document.createElement('div'),root=document.createElement('div');
    paper.style.cssText='position:absolute;left:-10000px;top:0;width:'+geometry.width+'px;height:'+(33*geometry.stride)+'px';
    root.style.position='relative';paper.append(root);document.body.append(paper);
    const sources=[{nodeId:'node-0',from:1,to:2},{nodeId:'node-0',from:9,to:10}];
    let reads=0;
    for(let index=0;index<660;index++){
      const node=document.createElement(index%3===0?'a':'span');node.id='node-'+index;
      if(index%3===0)node.setAttribute('href','#node-0');
      node.textContent='Anchor '+index;node.style.cssText='position:absolute;left:10px;top:'+(Math.floor(index/20)*geometry.stride+20+index%20)+'px';
      root.append(node);const rect=node.getBoundingClientRect.bind(node);
      node.getBoundingClientRect=()=>{reads++;return rect()};
    }
    const top=paper.getBoundingClientRect().top;
    const start=performance.now();
    const before=Array.from({length:33},(_,index)=>({
      targets:Array.from(root.querySelectorAll('[id]')).filter(node=>Math.floor((node.getBoundingClientRect().top-top)/geometry.stride)===index).map(node=>node.id),
      links:Array.from(root.querySelectorAll('a[href]')).filter(node=>Math.floor((node.getBoundingClientRect().top-top)/geometry.stride)===index).map(node=>node.id),
    }));
    const beforeMs=performance.now()-start,beforeReads=reads;reads=0;
    const nextStart=performance.now(),pages=chapterPages({paper,root,pages:33,sources},geometry),afterMs=performance.now()-nextStart;
    const afterReads=reads;
    const after=pages.map(page=>({targets:page.targets.map(node=>node.id),links:page.links.map(node=>node.id)}));
    const firstOwner=pages[0].sourceOf(root.querySelector('#node-0'))===sources[0];
    pages.forEach(page=>page.element.remove());paper.remove();
    const resource=new DocumentResources(new AbortController().signal);
    const styles=await Promise.all([resource.styles(),resource.styles()]);resource.assertCurrent();
    return {pages:33,nodes:660,beforeMs,afterMs,beforeReads,afterReads,equal:JSON.stringify(before)===JSON.stringify(after),firstOwner,resourceContract:styles[0]===styles[1]};
  `);
  fs.writeFileSync(path.join(artifacts,'page-descriptors.json'),JSON.stringify(report,null,2));
  assert.equal(report.equal,true);assert.equal(report.firstOwner,true);assert.equal(report.resourceContract,true);
  assert.equal(report.afterReads,660);assert.ok(report.beforeReads>report.afterReads*30);
  console.log('PASS page descriptor grouping:',artifacts,JSON.stringify(report));
};

exports.runMapping = async ({execute, artifacts}) => {
  const report = await execute(`
    setPages(false);await waitSaved();
    const {captureDocumentContexts}=await import('/src/document-export/snapshot/capture-contexts.ts');
    const {DocumentResources}=await import('/src/document-engine/resources/document-resources.ts');
    const geometry={width:600,height:800,stride:820};
    const context=document.createElement('div');
    context.style.cssText='position:absolute;left:-10000px;top:0;width:600px;height:1640px';
    const contentRoot=document.createElement('div');contentRoot.className='tiptap';contentRoot.style.position='relative';context.append(contentRoot);
    for(let index=0;index<2;index++){
      const anchor=document.createElement('a');anchor.id='destination-'+index;anchor.href='#destination-'+(1-index);
      anchor.textContent='LINK-PAGE-'+index;anchor.style.cssText='position:absolute;left:30px;top:'+(index*820+40)+'px';
      contentRoot.append(anchor);
    }
    document.body.append(context);
    const pages=[2,1].map(page=>{
      const element=document.createElement('div'),content=document.createElement('div');element.append(content);
      return {element,content,targets:[],links:[],projection:{context,page,pages:2,geometry}};
    });
    const signal=new AbortController().signal;
    try{
      const snapshot=await captureDocumentContexts(pages,{
        documentId:'fixture',title:'Projection mapping',author:'Writer',sourceHash:'a'.repeat(64),planHash:'b'.repeat(64),
        sections:[{id:'1',firstPage:1,pages:2,labels:['1','2']}],
      },new DocumentResources(signal),'',signal);
      return {views:snapshot.projection.views,targets:snapshot.projection.targets,links:snapshot.projection.links};
    }finally{context.remove()}
  `);
  fs.writeFileSync(path.join(artifacts,'projection-mapping.json'),JSON.stringify(report,null,2));
  assert.deepEqual(report.views,[{context:0,page:2},{context:0,page:1}]);
  assert.deepEqual(report.targets.map(({id,page,x,y})=>({id,page,x,y})),[
    {id:'destination-0',page:2,x:30,y:40},{id:'destination-1',page:1,x:30,y:40},
  ]);
  assert.deepEqual(report.links.map(({target,page,x,y})=>({target,page,x,y})),[
    {target:'destination-1',page:2,x:30,y:40},{target:'destination-0',page:1,x:30,y:40},
  ]);
  console.log('PASS projection mapping:',artifacts,JSON.stringify(report));
};
