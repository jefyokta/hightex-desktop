// Normal chapter calibration for the replacement design; does not certify it.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { hash } = require('./local-archives.cjs');
const { stats, sampleMemory, settled, inputBatch, installInputMetrics, disposeInputMetrics } = require('./editor-input-metrics.cjs');

const workloads = [
  { id: 'W1', archive: 'doc-08', chapter: '1' },
  { id: 'W2', archive: 'doc-03', chapter: '2' },
  { id: 'W3', archive: 'doc-03', chapter: '4' },
  { id: 'W4', archive: 'doc-05', chapter: '2' },
];

async function mountMode(context, mode) {
  const { execute, until } = context;
  await execute(`
    await archiveStorage.waitForChapter(baselineChapter.getId());
    await db.chapters.put(structuredClone(baselineRecord));
    window.mountChapterFixture(baselineChapter,${mode !== 'baseline'});
  `);
  await until('window.ready&&window.editor&&!editor.isDestroyed&&window.archiveEvents&&editor.isEditable');
  await installInputMetrics(execute, await execute('return baselineChapter.getId()'));
  await execute(`
    benchmark.mode=${JSON.stringify(mode)};benchmark.initial=editor.getJSON();benchmark.initialText=editor.state.doc.textContent.length;
    benchmark.editor.commands.focus();
    if(${mode === 'on'})benchmark.editor.commands.setEditorPagination(true);
    await document.fonts.ready;
  `);
  await until("Array.from(editor.view.dom.querySelectorAll('img:not(.ProseMirror-separator)')).every(image=>image.complete&&image.naturalWidth>0)");
  if (mode === 'on') {
    await execute(`
      const {waitForEditorExport}=await import('/src/document-export/source/editor-readiness.ts');
      const task=new AbortController(),timer=setTimeout(()=>task.abort(new Error('Baseline readiness deadline')),20000);
      try{await waitForEditorExport(editor,task.signal)}finally{clearTimeout(timer)}
    `);
  }
  await settled(context);
  const state = await execute(`return {extensionPresent:editor.extensionManager.extensions.some(extension=>extension.name==='editorPagination'),...benchmark.state()}`);
  assert.equal(state.extensionPresent, mode !== 'baseline');
  assert.equal(state.enabled, mode === 'on');
  return state;
}

async function positionAt(execute, kind) {
  return execute(`
    const points=[];
    benchmark.editor.state.doc.descendants((node,pos)=>{
      if(node.type.name!=='paragraph'||!node.textContent)return;
      const resolved=benchmark.editor.state.doc.resolve(pos),ancestors=Array.from({length:resolved.depth},(_,i)=>resolved.node(i+1).type.name);
      points.push({pos:pos+1,list:ancestors.includes('listItem'),table:ancestors.some(type=>type==='tableCell'||type==='tableHeader')});
    });
    const kind=${JSON.stringify(kind)};
    const target=kind==='list'?points.find(point=>point.list):kind==='table'?points.find(point=>point.table):kind==='middle'?points[Math.floor(points.length/2)]:kind==='end'?points.at(-1):points[0];
    if(!target)return null;
    benchmark.editor.commands.setTextSelection(target.pos);benchmark.editor.commands.focus(undefined,{scrollIntoView:true});
    return target;
  `);
}

async function runMode(context, mode, round, samples) {
  const { execute, win } = context;
  const start = Date.now();
  const state = await mountMode(context, mode);
  const coldReadyMs = Date.now() - start;
  if(process.env.HIGHTEX_INPUT_CDP)win.showInactive();else{win.show();win.focus();win.webContents.focus();}
  await positionAt(execute, 'start');
  await context.until('document.activeElement===editor.view.dom'+(process.env.HIGHTEX_INPUT_CDP?'':'&&document.hasFocus()'));
  await inputBatch(context, 'burst', 20);
  await execute('benchmark.editor.commands.setContent(benchmark.initial);await benchmark.save()');
  await settled(context);
  await win.webContents.debugger.sendCommand('HeapProfiler.collectGarbage');
  const memoryBefore = sampleMemory(win), heapBefore = await win.webContents.debugger.sendCommand('Runtime.getHeapUsage'), batches = [];
  if(process.env.HIGHTEX_LAYOUT_PROFILE&&mode==='on'){
    await win.webContents.debugger.sendCommand('Profiler.enable');
    await win.webContents.debugger.sendCommand('Profiler.start');
  }
  const kinds = [];
  for (const kind of ['start', 'middle', 'end', 'list', 'table'])
    if (await positionAt(execute, kind)) kinds.push(kind);
  let remaining = samples;
  for (const [index, kind] of kinds.entries()) {
    const target = await positionAt(execute, kind);
    const count = Math.ceil(remaining / (kinds.length - index));
    remaining -= count;
    batches.push({ kind, target, ...await inputBatch(context, 'burst', count) });
  }
  const keys = batches.flatMap(batch => batch.keys), reflows = batches.flatMap(batch => batch.reflows);
  if(process.env.HIGHTEX_LAYOUT_PROFILE&&mode==='on'){
    const {profile}=await win.webContents.debugger.sendCommand('Profiler.stop');
    fs.writeFileSync(path.join(context.artifacts,'layout-cpu-profile.json'),JSON.stringify(profile));
  }
  const memoryBeforeGC = sampleMemory(win);
  await win.webContents.debugger.sendCommand('HeapProfiler.collectGarbage');
  const result = {
    mode, round, state, coldReadyMs, memoryBefore, heapBefore, memoryBeforeGC,
    memoryAfter: sampleMemory(win), heapAfter: await win.webContents.debugger.sendCommand('Runtime.getHeapUsage'),
    domAfter: await win.webContents.debugger.sendCommand('Memory.getDOMCounters'), batches,
    firstFrameMs: stats(keys.map(key => key.toFirstFrame)),
    twoFrameMs: stats(keys.map(key => key.toSecondFrame)),
    reflowMs: reflows.length ? stats(reflows) : null,
    source: await execute('return {json:JSON.stringify(benchmark.initial),characters:benchmark.initialText,nodes:editor.view.dom.querySelectorAll("*").length,history:{undo:nativeEditor.undoDepth(editor.state),redo:nativeEditor.redoDepth(editor.state)}}'),
  };
  result.source.hash = hash(result.source.json);
  delete result.source.json;
  await disposeInputMetrics(execute);
  return result;
}

exports.run = async context => {
  const { execute, until, win, artifacts, files, importArchive } = context;
  const requested = process.env.HIGHTEX_BASELINE_WORKLOADS?.split(',');
  const selected = workloads.filter(workload => !requested || requested.includes(workload.id));
  const samples = Number(process.env.HIGHTEX_BASELINE_SAMPLES ?? 100);
  const rounds = Number(process.env.HIGHTEX_BASELINE_ROUNDS ?? 3);
  const modes=process.env.HIGHTEX_BASELINE_MODES?.split(',')??['baseline','off','on'];
  assert.ok(modes.length&&modes.every(mode=>['baseline','off','on'].includes(mode)),'Unknown measurement mode');
  assert(selected.length && Number.isInteger(samples) && samples >= 20 && samples <= 100 && Number.isInteger(rounds) && rounds >= 1 && rounds <= 3, 'Invalid bounded baseline protocol');
  const report = {
    purpose: 'Current editor baseline for replacement design; not replacement acceptance.',
    hardware: { cpu: os.cpus()[0]?.model, ramBytes: os.totalmem(), platform: process.platform, arch: process.arch },
    versions: process.versions,
    protocol: { samples, rounds, modes, profiling:Boolean(process.env.HIGHTEX_LAYOUT_PROFILE), warmup: 20, nativeIntervalMs: 30, input:process.env.HIGHTEX_INPUT_CDP?'trusted Chromium CDP events to an inactive fixture window; no OS keyboard focus':'Electron sendInputEvent to focused fixture window', positions: ['start', 'middle', 'end', 'list when present', 'table when present'], numbering: 'disabled in every mode; measure global numbering separately', baseline: 'fresh editor without the pagination extension', source: 'freeze schema defaults and editor-assigned identities once on the isolated copy, then require exact source hashes across modes', memoryUnits: 'KiB from app.getAppMetrics; GC outside input measurements', latency: 'trusted keydown to first/second animation frame, a paint opportunity proxy, not physical display latency' },
    cases: [], memorySamples: [],
  };
  const save = () => fs.writeFileSync(path.join(artifacts, 'normal-chapter-baseline.json'), JSON.stringify(report, null, 2));
  let memoryTimer;
  if(process.env.HIGHTEX_INPUT_CDP)win.showInactive();else{win.show();win.focus();win.webContents.focus();}
  win.webContents.debugger.attach('1.3');
  try {
    memoryTimer = setInterval(() => report.memorySamples.push(sampleMemory(win)), 250);
    for (const workload of selected) {
      console.log('Baseline workload:', workload.id);
      const file = files.find(file => file.label === workload.archive);
      assert(file, 'Required local archive missing');
      const imported = await importArchive(execute, file);
      await execute(`
        window.baselineChapter=archiveContext.chapters.find(chapter=>chapter.getChapter()===${JSON.stringify(workload.chapter)});
        window.baselineRecord=await db.chapters.get(baselineChapter.getId());
      `);
      const entry = { ...workload, archiveSha256: file.originalHash, imported, runs: [] };
      report.cases.push(entry);save();
      await mountMode(context, 'baseline');
      const conditioned = await execute('baselineRecord.content=structuredClone(benchmark.initial.content);await db.chapters.put(baselineRecord);return benchmark.initial');
      entry.sourceHash = hash(JSON.stringify(conditioned));
      fs.writeFileSync(path.join(artifacts, workload.id + '-source.json'), JSON.stringify(conditioned, null, 2));
      await disposeInputMetrics(execute);
      const orders = [['baseline', 'off', 'on'], ['on', 'baseline', 'off'], ['off', 'on', 'baseline']];
      for (let round = 0; round < rounds; round++)
        for (const mode of orders[round].filter(mode=>modes.includes(mode))) {
          console.log('Baseline mode:', workload.id, mode, 'round', round + 1);
          entry.runs.push(await runMode(context, mode, round + 1, samples));save();
        }
      assert.equal(new Set(entry.runs.map(run=>run.source.hash)).size, 1, 'Modes started from different sources');
      await execute('await archiveStorage.waitForChapter(baselineChapter.getId());editor.destroy();window.editor=null;window.benchmark=undefined;window.mountChapterFixture(archiveFixture,false)');
      await until('window.ready&&window.editor&&!editor.isDestroyed');
      await win.webContents.debugger.sendCommand('HeapProfiler.collectGarbage');
      entry.afterRelease = { memory: sampleMemory(win), dom: await win.webContents.debugger.sendCommand('Memory.getDOMCounters') };
      await execute('archiveContext.destroy()');save();
    }
    report.rendererErrors = await execute('return window.errors');
    report.complete = true;save();
    console.log('RECORDED: normal chapter calibration, not feature acceptance. Artifacts:', artifacts);
  } catch(error) {
    report.failure = { message: error.message, stack: error.stack };save();throw error;
  } finally {
    clearInterval(memoryTimer);
    await disposeInputMetrics(execute).catch(() => {});
    win.webContents.debugger.detach();
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  process.env.HIGHTEX_EDITOR_PDF_PIPELINE = '1';
  process.env.HIGHTEX_EDITOR_PDF_ARCHIVES = '1';
  process.env.HIGHTEX_PAGINATION_BASELINE = '1';
  require('./editor-pagination.cjs');
}
