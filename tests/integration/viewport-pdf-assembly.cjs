// Load the actual main-process implementation in the isolated CommonJS fixture.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const output = ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../../electron/pdf/page-assembly.ts'),'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},
}).outputText;
const loaded={exports:{}};
new Function('exports','require',output)(loaded.exports,require);
exports.ViewportPDFAssembly=loaded.exports.PDFPageAssembly;
