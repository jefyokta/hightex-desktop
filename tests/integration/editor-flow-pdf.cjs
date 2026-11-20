const path=require('node:path');
exports.run=context=>require('./editor-section-pdf.cjs').run(context,{
  cases:process.env.HIGHTEX_FLOW_PDF_CASES?.split(',')??['flow'],modes:['both'],reportName:'flow-pdf.json',
  inputModule:'/tests/helpers/text-flow-input.ts',inputFunction:'textFlowInput',
  // Chromium paints disc markers as graphics; numbered markers are extractable text.
  generatedText:{flow:'7.8.c.d.1.1',rules:'1.1','cut-before':'7.8.c.d.1.1','cut-at':'7.8.c.d.1.1','cut-after':'7.8.c.d.1.1'},
  cutOffsets:{'cut-before':-1,'cut-at':0,'cut-after':1},
  requiredBreakReasons:{rules:['widow','orphan','keep-with-next']},
});
if(process.argv[1]&&path.resolve(process.argv[1])===__filename){
  process.env.HIGHTEX_FLOW_PDF='1';process.env.HIGHTEX_EDITOR_PDF_PIPELINE='1';require('./editor-pagination.cjs');
}
