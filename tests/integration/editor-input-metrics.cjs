// Shared native input measurements for normal chapters and the stress fixture.
const assert = require('node:assert/strict');
const { app } = require('electron');

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

function stats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: sorted.length,
    p50: sorted[Math.ceil(sorted.length * 0.5) - 1],
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
    max: sorted.at(-1),
  };
}

async function installInputMetrics(execute, chapterId = 'fixture.1') {
  await execute(`
    if(${Boolean(process.env.HIGHTEX_LAYOUT_PROFILE)}&&!window.layoutProfileInstalled){
      window.layoutProfileInstalled=true;window.layoutProfile={phases:[],flow:{hit:0,miss:0}};
      const methods=[
        [(await import('/src/editor/chapter/layout-source.ts')).EditorLayoutSource.prototype,'read','source'],
        [(await import('/src/document-engine/layout/chapter-compiler.ts')).ChapterLayoutCompiler.prototype,'compile','compile'],
        [(await import('/src/editor/chapter/read-only-chapter.ts')).ReadOnlyChapter.prototype,'applyLayout','apply'],
        [(await import('/src/editor/chapter/read-only-chapter.ts')).ReadOnlyChapter.prototype,'resolve','presentation'],
        [(await import('/src/editor/pagination/measurement/layout-snapshot.ts')).LayoutSnapshot.prototype,'copy','snapshot.copy'],
        [(await import('/src/editor/pagination/measurement/layout-snapshot.ts')).LayoutSnapshot.prototype,'margin','snapshot.margin']
      ];
      for(const [prototype,name,phase] of methods){const original=prototype[name];prototype[name]=function(...args){
        const start=performance.now(),done=()=>layoutProfile.phases.push({phase,start,ms:performance.now()-start});
        try {const result=original.apply(this,args);if(result?.then)return result.finally(done);done();return result}
        catch(error){done();throw error}
      }}
      const prototype=(await import('/src/editor/pagination/flow/text-flow.ts')).FlowCache.prototype,original=prototype.get;
      prototype.get=function(...args){const result=original.apply(this,args);layoutProfile.flow[result?'hit':'miss']++;return result};
    }
    const subject=window.editor;
    window.benchmarkKey=(await import('/src/editor/pagination/index.ts')).paginationKey;
    const storage=(await import('/src/editor/storage/index.ts')).Storage.instance;
    window.benchmark={editor:subject,chapterId:${JSON.stringify(chapterId)},plugin:subject.state.plugins.find(plugin=>plugin.key===benchmarkKey.key),keys:[],longTasks:[],pending:[]};
    benchmark.save=()=>storage.waitForChapter(benchmark.chapterId);
    benchmark.observer=new PerformanceObserver(list=>{for(const entry of list.getEntries())benchmark.longTasks.push({start:entry.startTime,duration:entry.duration})});
    benchmark.observer.observe({type:'longtask',buffered:false});
    benchmark.onKey=event=>{
      if(!event.isTrusted||event.key!=='x')return;
      const sample={start:performance.now(),eventTime:event.timeStamp,mode:benchmark.mode};benchmark.keys.push(sample);
      requestAnimationFrame(()=>{sample.firstFrame=performance.now();requestAnimationFrame(()=>{sample.secondFrame=performance.now()})});
    };
    subject.view.dom.addEventListener('keydown',benchmark.onKey);
    benchmark.inputs=[];benchmark.onBeforeInput=event=>benchmark.inputs.push({type:event.inputType,data:event.data?.slice(0,50),trusted:event.isTrusted});
    subject.view.dom.addEventListener('beforeinput',benchmark.onBeforeInput);
    benchmark.onTransaction=({transaction})=>{
      if(transaction.docChanged){benchmark.lastEdit=performance.now();benchmark.source=subject.state.doc}
      const state=benchmarkKey.getState(subject.state);
      if(state?.enabled&&!state.pending&&!state.layout.error&&benchmark.lastEdit&&subject.state.doc===benchmark.source){
        benchmark.pending.push({edit:benchmark.lastEdit,ready:performance.now(),pages:state.layout.pages});benchmark.lastEdit=undefined;
      }
    };
    subject.on('transaction',benchmark.onTransaction);
    benchmark.state=()=>{
      const state=benchmarkKey.getState(subject.state);
      return {enabled:state?.enabled??false,pending:state?.pending??false,error:state?.layout.error??false,pages:state?.layout.pages??null,
        measuring:document.querySelectorAll('[data-pagination-measure]').length,sheets:document.querySelectorAll('.editor-pagination-sheet').length};
    };
  `);
}

function sampleMemory(win) {
  const renderer = app.getAppMetrics().find(metric => metric.pid === win.webContents.getOSProcessId());
  const main = app.getAppMetrics().find(metric => metric.pid === process.pid);
  return { time: Date.now(), renderer: renderer?.memory, main: main?.memory };
}

async function settled(context, timeout = 12000) {
  await context.until('!benchmark.state().pending&&!benchmark.state().measuring', timeout);
  assert.equal(await context.execute('return benchmark.state().error'), false, 'Layout failed');
  await context.execute('await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame)');
  assert.equal(await context.execute('return benchmark.state().pending'), false, 'Plan invalidated after settling');
}

async function inputBatch(context, kind, count) {
  const { execute, win } = context;
  await execute('benchmark.keys=[];benchmark.inputs=[];benchmark.pending=[];benchmark.longTasks=[];benchmark.lastEdit=undefined;benchmark.beforeText=benchmark.editor.state.doc.textContent;benchmark.started=performance.now();if(window.layoutProfile){layoutProfile.phases=[];layoutProfile.flow={hit:0,miss:0}}');
  for (let index = 0; index < count; index++) {
    if(process.env.HIGHTEX_INPUT_CDP){
      await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent',{type:'keyDown',key:'x',code:'KeyX',text:'x',unmodifiedText:'x',windowsVirtualKeyCode:88});
      await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent',{type:'keyUp',key:'x',code:'KeyX',windowsVirtualKeyCode:88});
    } else {
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'X' });
    win.webContents.sendInputEvent({ type: 'char', keyCode: 'x' });
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'X' });
    }
    if (kind === 'paced') {
      await settled(context);
      await pause(35);
    } else await pause(kind === 'overlap' ? 170 : 30);
  }
  await settled(context);
  await execute('await benchmark.save()');
  const result = await execute(`
    const keys=benchmark.keys.map(key=>({...key,toFirstFrame:key.firstFrame-key.start,toSecondFrame:key.secondFrame-key.start,queueDelay:key.start-key.eventTime}));
    const reflows=benchmark.pending.map(item=>item.ready-item.edit);
    const expected=benchmark.beforeText.length+${count};
    const after=benchmark.editor.state.doc.textContent;
    let difference;
    if(after.length!==expected){let from=0;while(from<Math.min(after.length,benchmark.beforeText.length)&&after[from]===benchmark.beforeText[from])from++;
      let suffix=0;while(suffix<Math.min(after.length,benchmark.beforeText.length)-from&&after[after.length-1-suffix]===benchmark.beforeText[benchmark.beforeText.length-1-suffix])suffix++;
      difference={from,removed:benchmark.beforeText.slice(from,benchmark.beforeText.length-suffix).slice(0,80),added:after.slice(from,after.length-suffix).slice(0,80),inputs:benchmark.inputs};}
    return {keys,reflows,longTasks:benchmark.longTasks,textLength:benchmark.editor.state.doc.textContent.length,expected,
      stored:JSON.stringify((await db.chapters.get(benchmark.chapterId)).content)===JSON.stringify(benchmark.editor.getJSON().content),state:benchmark.state(),
      ...(window.layoutProfile?{profile:structuredClone(layoutProfile)}:{}),difference};
  `);
  assert.equal(result.keys.length, count, 'Native key events missing');
  assert.equal(result.textLength, result.expected, 'Native typed text differs: '+JSON.stringify(result.difference));
  assert.equal(result.stored, true, 'Autosave differs from editor');
  assert.ok(result.keys.every(key => Number.isFinite(key.toSecondFrame)), 'Incomplete frame timing');
  return {
    ...result,
    firstFrameMs: stats(result.keys.map(key => key.toFirstFrame)),
    twoFrameMs: stats(result.keys.map(key => key.toSecondFrame)),
    reflowMs: result.reflows.length ? stats(result.reflows) : null,
  };
}

async function disposeInputMetrics(execute) {
  await execute('benchmark.observer.disconnect();benchmark.editor.view.dom.removeEventListener("keydown",benchmark.onKey);benchmark.editor.view.dom.removeEventListener("beforeinput",benchmark.onBeforeInput);benchmark.editor.off("transaction",benchmark.onTransaction)');
}

module.exports = { stats, sampleMemory, settled, inputBatch, installInputMetrics, disposeInputMetrics };
