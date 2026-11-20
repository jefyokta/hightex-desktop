const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { createHash } = require("node:crypto");
const { sampleMemory, settled, inputBatch, installInputMetrics, disposeInputMetrics } = require("./editor-input-metrics.cjs");
const hash = (value) => createHash("sha256").update(value).digest("hex");

async function installProbe(execute) {
  await installInputMetrics(execute);
  await execute(`
    benchmark.install=async mode=>{
      if(benchmarkKey.getState(editor.state))editor.commands.setEditorPagination(false);
      if(mode==='baseline')editor.unregisterPlugin(benchmarkKey);
      else if(!benchmarkKey.getState(editor.state))editor.registerPlugin(benchmark.plugin);
      benchmark.mode=mode;editor.commands.setContent(benchmark.input);await waitSaved();
      editor.commands.setTextSelection(editor.state.doc.child(0).nodeSize+1);editor.commands.focus();
      if(mode==='on')editor.commands.setEditorPagination(true);
    };
  `);
}

async function installDocument(context, blocks) {
  await context.execute(`
    if(!benchmarkKey.getState(editor.state))editor.registerPlugin(benchmark.plugin);
    if(benchmarkKey.getState(editor.state))editor.commands.setEditorPagination(false);
    const content=[{type:'heading',attrs:{level:1,id:'benchmark-heading'},content:[{type:'text',text:'Pengukuran dokumen besar'}]}];
    for(let index=0;index<${blocks};index++){
      content.push({type:'paragraph',attrs:{id:'bench-p-'+index},content:[{type:'text',text:'Paragraf '+index+'. '+sentence.repeat(3)}]});
      if(index>0&&index%300===0){const table=makeTable(30);table.attrs={id:'bench-table-'+index,figureId:'bench-table-figure-'+index};content.push(table)}
    }
    editor.commands.setContent({type:'doc',content});await waitSaved();await document.fonts.ready;
    benchmark.input=editor.getJSON();benchmark.json=JSON.stringify(benchmark.input);
    benchmark.beforeUpdates=updates;benchmark.coldStart=performance.now();setPages(true);
  `);
  await settled(context);
  const data =
    await context.execute(`return {blocks:${blocks},pages:layout().pages,characters:editor.state.doc.textContent.length,nodes:editor.view.dom.querySelectorAll('*').length,
    coldReflowMs:performance.now()-benchmark.coldStart,json:benchmark.json,unchanged:benchmark.json===JSON.stringify(editor.getJSON()),noAutosave:updates===benchmark.beforeUpdates,
    geometry:paginationGeometry(),fonts:document.fonts.status}`);
  assert.ok(
    data.pages >= 100 && data.pages <= 200,
    "Benchmark chapter outside 100–200 pages: " + data.pages,
  );
  assert.equal(data.unchanged, true);
  assert.equal(data.noAutosave, true);
  return { ...data, inputHash: hash(data.json), json: undefined };
}

async function runMode(context, mode, round, overlapOnly = false) {
  console.log("Benchmark mode:", mode, "round", round);
  await context.execute(`await benchmark.install(${JSON.stringify(mode)})`);
  await settled(context);
  await context.until(
    "document.activeElement===editor.view.dom&&document.hasFocus()",
  );
  // Warm the input/paint path, then restore identical content before sampling.
  await inputBatch(context, "burst", 2);
  await context.execute(`await benchmark.install(${JSON.stringify(mode)})`);
  await settled(context);
  const memoryBefore = sampleMemory(context.win);
  if (overlapOnly) {
    const overlap = await inputBatch(context, "overlap", 12);
    return {
      mode,
      round,
      memoryBefore,
      overlap,
      memoryAfter: sampleMemory(context.win),
    };
  }
  const burst = await inputBatch(context, "burst", 8),
    paced = await inputBatch(context, "paced", 8);
  return {
    mode,
    round,
    memoryBefore,
    burst,
    paced,
    memoryAfter: sampleMemory(context.win),
  };
}

async function cleanupProbe(context) {
  await context.execute(`
    if(benchmarkKey.getState(editor.state))editor.commands.setEditorPagination(false);
    editor.commands.setContent({type:'doc',content:[{type:'heading',attrs:{level:1},content:[{type:'text',text:'Cleanup'}]},p('Benchmark complete.')]});await waitSaved();
  `);
  await settled(context);
  await context.win.webContents.debugger.sendCommand(
    "HeapProfiler.collectGarbage",
  );
  const memory = sampleMemory(context.win);
  const dom = await context.execute(
    'return {state:benchmark.state(),nodes:editor.view.dom.querySelectorAll("*").length,errors:window.errors}',
  );
  assert.equal(dom.state.measuring, 0);
  assert.equal(dom.state.sheets, 0);
  assert.deepEqual(dom.errors, []);
  return { memory, dom };
}

exports.runBenchmark = async (context) => {
  const { execute, win, artifacts } = context;
  const blocks = (process.env.HIGHTEX_BENCH_BLOCKS ?? "1000,1400")
    .split(",")
    .map(Number);
  const overlapOnly = process.env.HIGHTEX_BENCH_PROFILE === "overlap";
  assert.ok(
    blocks.length &&
      blocks.every(
        (value) => Number.isInteger(value) && value > 0 && value <= 2000,
      ),
    "Invalid benchmark sizes",
  );
  const report = {
    hardware: {
      cpu: os.cpus()[0].model,
      cores: os.cpus().length,
      ramGiB: os.totalmem() / 1024 ** 3,
      platform: process.platform,
      arch: process.arch,
      release: os.release(),
    },
    versions: process.versions,
    source: {
      head: execGit(["rev-parse", "HEAD"]),
      trackedDiffHash: hash(execGit(["diff", "--", "src", "electron"])),
    },
    protocol: {
      blocks,
      profile: overlapOnly ? "overlap" : "paired",
      rounds: overlapOnly ? 1 : 2,
      samplesPerBatch: overlapOnly ? 12 : 8,
      burstIntervalMs: 30,
      overlapIntervalMs: 170,
      paced: "wait for reflow completion then 35 ms",
      memoryUnits: "KiB from Electron app.getAppMetrics",
      latency:
        "trusted native keydown in renderer to first/second requestAnimationFrame; two frames are a paint opportunity proxy, not physical display presentation",
      baseline:
        "same current editor with pagination plugin unregistered; not historical pre-feature baseline",
      limits: [
        "Small sample count; nearest-rank p95 has low confidence",
        "Shown foreground Electron fixture uses software rendering",
        "Not a <50ms physical-key-to-presented-pixels certification",
        "RAM is observed hardware, not an approved performance reference",
      ],
    },
    cases: [],
    memorySamples: [],
  };
  const save = () =>
    fs.writeFileSync(
      path.join(artifacts, "large-document-benchmark.json"),
      JSON.stringify(report, null, 2),
    );
  let memoryTimer;
  win.show();
  win.focus();
  win.webContents.focus();
  win.webContents.debugger.attach("1.3");
  try {
    await installProbe(execute);
    report.runtime = await execute(
      "return {viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},fonts:Array.from(document.fonts,face=>({family:face.family,status:face.status}))}",
    );
    report.before = sampleMemory(win);
    save();
    memoryTimer = setInterval(() => {
      report.memorySamples.push(sampleMemory(win));
    }, 250);
    for (const blocks of report.protocol.blocks) {
      const entry = { blocks, runs: [] };
      report.cases.push(entry);
      save();
      console.log("Benchmark document:", blocks);
      Object.assign(entry, await installDocument(context, blocks));
      save();
      console.log(
        "Benchmark pages:",
        entry.pages,
        "cold ms:",
        entry.coldReflowMs,
      );
      const rounds = overlapOnly
        ? [["overlap", ["on"]]]
        : [
            ["A", ["baseline", "off", "on"]],
            ["B", ["on", "off", "baseline"]],
          ];
      for (const [round, modes] of rounds)
        for (const mode of modes) {
          entry.runs.push(await runMode(context, mode, round, overlapOnly));
          save();
        }
      entry.cleanup = await cleanupProbe(context);
      save();
    }
    report.complete = true;
    save();
    console.log(
      "PASS: large-document benchmark completed; numerical budgets require separate evaluation.",
    );
    console.log("Benchmark evidence:", artifacts);
  } catch (error) {
    report.failure = { message: error.message, stack: error.stack };
    save();
    throw error;
  } finally {
    clearInterval(memoryTimer);
    await disposeInputMetrics(execute).catch(() => {});
    win.webContents.debugger.detach();
  }
};
function execGit(args) {
  return require("node:child_process")
    .execFileSync("git", args, { encoding: "utf8" })
    .trim();
}
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  process.env.HIGHTEX_PAGINATION_BENCHMARK = "1";
  require("./editor-pagination.cjs");
}
