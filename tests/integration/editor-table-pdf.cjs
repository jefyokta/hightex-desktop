const path=require('node:path');
exports.run=context=>require('./editor-section-pdf.cjs').run(context);
if(process.argv[1]&&path.resolve(process.argv[1])===__filename){
  process.env.HIGHTEX_TABLE_PDF='1';process.env.HIGHTEX_EDITOR_PDF_PIPELINE='1';require('./editor-pagination.cjs');
}
