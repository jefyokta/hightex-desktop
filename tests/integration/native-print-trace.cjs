const fs = require('node:fs');
const path = require('node:path');
const {app} = require('electron');

exports.profileNativeProcesses = async (artifacts, print) => {
  const samples = [];
  const record = () => samples.push({ms:performance.now(),processes:app.getAppMetrics().map(item=>({
    pid:item.pid,type:item.type,name:item.name,serviceName:item.serviceName,cpu:item.cpu,
  }))});
  record();
  const timer = setInterval(record,250);
  try {return await print();}
  finally {
    clearInterval(timer);record();
    fs.writeFileSync(path.join(artifacts,'native-process-cpu.json'),JSON.stringify(samples,null,2));
  }
};

// Bounded diagnostic of one native print; never enabled by the application.
exports.traceNativePrint = async (win, artifacts, print) => {
  const debug = win.webContents.debugger;
  const events = [];
  let completed;
  const ended = new Promise(resolve => {completed = resolve;});
  const listener = (_event, method, params) => {
    if(method==='Tracing.dataCollected')events.push(...params.value);
    if(method==='Tracing.tracingComplete')completed(params);
  };
  debug.attach('1.3');debug.on('message',listener);
  await debug.sendCommand('Performance.enable');
  const before = await debug.sendCommand('Performance.getMetrics');
  await debug.sendCommand('Tracing.start',{
    transferMode:'ReportEvents',
    traceConfig:{recordMode:'recordUntilFull',traceBufferSizeInKb:16384,
      includedCategories:['devtools.timeline','blink','cc','skia','printing','toplevel']},
  });
  try {return await print();}
  finally {
    try {
      const after = await debug.sendCommand('Performance.getMetrics');
      await debug.sendCommand('Tracing.end');
      const completion = await ended;
      fs.writeFileSync(path.join(artifacts,'native-print-trace.json'),JSON.stringify({traceEvents:events}));
      const initial = Object.fromEntries(before.metrics.map(item=>[item.name,item.value]));
      fs.writeFileSync(path.join(artifacts,'native-print-metrics.json'),JSON.stringify({completion,
        metrics:after.metrics.map(item=>({...item,before:initial[item.name],delta:item.value-initial[item.name]}))},null,2));
    } finally {debug.removeListener('message',listener);debug.detach();}
  }
};
