// Bounded cell-width regression through real Tiptap, persistence and native PDF owners.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { BrowserWindow } = require('electron');

exports.run = async context => {
  if(process.env.HIGHTEX_TABLE_WIDTHS_APPLY)return require('./editor-table-width-apply.cjs').run(context);
  const { execute, until, artifacts } = context;
  const ux = Boolean(process.env.HIGHTEX_TABLE_WIDTHS_UX);
  const report = { interactions: [] };
  const save = () => fs.writeFileSync(path.join(artifacts, 'cell-width-interactions.json'), JSON.stringify(report, null, 2));
  await execute(`
    window.widthMetrics=()=>({
      source:JSON.stringify(editor.getJSON()),
      tables:[...editor.view.dom.querySelectorAll('table')].map(table=>({
        width:parseFloat(getComputedStyle(table).width),available:parseFloat(getComputedStyle(table.parentElement).width),
        left:table.getBoundingClientRect().left,right:table.getBoundingClientRect().right,
        edges:[...table.rows[0].cells].map(cell=>cell.getBoundingClientRect().right),
        columns:[...table.querySelectorAll(':scope > colgroup > col')].map(col=>parseFloat(getComputedStyle(col).width)),
        styles:[...table.querySelectorAll(':scope > colgroup > col')].map(col=>col.style.width),
      })),
      history:historyDepth(),error:layout().error??false,
      feedback:document.querySelector('.table-column-resize-feedback')?.textContent??null,
      limited:document.querySelector('.table-column-resize-feedback')?.dataset.limited??null,
    });
  `);
  const win = BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/'));
  async function setup(variant) {
    await execute(`setPages(false);const {tableWidthInput}=await import('/tests/helpers/table-width-input.ts');editor.commands.setContent({type:'doc',content:[{type:'heading',attrs:{level:1},content:[{type:'text',text:'Cell width regression'}]},...tableWidthInput(${JSON.stringify(variant)})]});await waitSaved();setPages(true);`);
    await until('layoutReady()&&!layout().error');
  }
  async function begin(tableIndex, column) {
    const point = await execute(`
      const cell=editor.view.dom.querySelectorAll('table')[${tableIndex}].rows[0].cells[${column}];cell.scrollIntoView({block:'center'});
      const box=cell.getBoundingClientRect();return {x:Math.round(box.right-2),y:Math.round(box.top+Math.min(12,box.height/2))};
    `);
    win.webContents.sendInputEvent({ type: 'mouseMove', ...point });
    await execute('await new Promise(requestAnimationFrame)');
    assert.ok(await execute(`return (await import('/tests/helpers/table-width-input.ts')).columnResizingPluginKey.getState(editor.state).activeHandle>=0`));
    win.webContents.sendInputEvent({ type: 'mouseDown', ...point, button: 'left', clickCount: 1 });
    return point;
  }
  async function drag(name, tableIndex, column, dx, cancel = false) {
    await execute('closeHistory()');
    const before = await execute('return widthMetrics()');
    const point = await begin(tableIndex, column), target = { x: point.x + dx, y: point.y };
    win.webContents.sendInputEvent({ type: 'mouseMove', ...target, modifiers: ['leftButtonDown'] });
    // Allow ResizeObserver to run during a held gesture; it must retain the preview.
    await execute('for(let i=0;i<4;i++)await new Promise(requestAnimationFrame)');
    const preview = await execute('return widthMetrics()');
    assert.equal(preview.source, before.source, 'Preview changed authored source');
    assert.ok(preview.feedback?.includes('px'), 'No visible width feedback');
    if (ux && name==='container-limit') {
      assert.equal(preview.limited,'true');
      fs.writeFileSync(path.join(artifacts,'cell-width-limit.png'),(await win.webContents.capturePage()).toPNG());
    }
    if (ux && name==='normal') fs.writeFileSync(path.join(artifacts,'cell-width-drag.png'),(await win.webContents.capturePage()).toPNG());
    if (cancel) {
      win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
      win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
    }
    win.webContents.sendInputEvent({ type: 'mouseUp', ...target, button: 'left', clickCount: 1 });
    await execute('await waitSaved()');await until('layoutReady()&&!layout().error');
    const after = await execute('return widthMetrics()');
    assert.equal(after.feedback,null,'Width feedback leaked after gesture');
    assert.equal(await execute(`return document.body.classList.contains('table-column-resizing')`),false);
    const item = { name, before, preview, after };report.interactions.push(item);save();
    if (cancel) {
      assert.equal(after.source, before.source);assert.deepEqual(after.tables, before.tables);assert.deepEqual(after.history, before.history);
    } else {
      assert.deepEqual(after.tables, preview.tables, name + ': preview and commit differ');
      assert.equal(after.tables[tableIndex].width <= after.tables[tableIndex].available, true, name + ': table exceeds container');
      await execute('editor.commands.undo();await waitSaved()');await until('layoutReady()&&!layout().error');
      assert.equal((await execute('return widthMetrics()')).source, before.source, name + ': undo did not restore source');
      await execute('editor.commands.redo();await waitSaved()');await until('layoutReady()&&!layout().error');
      assert.equal((await execute('return widthMetrics()')).source, after.source, name + ': redo did not restore source');
    }
    return item;
  }
  await setup('fixed');
  assert.deepEqual((await execute('return widthMetrics()')).tables[0].styles, ['120px','160px','180px']);
  const normal=await drag('normal', 0, 0, 60);
  assert.deepEqual(normal.after.tables[0].columns,[180,100,180]);
  assert.equal(normal.after.tables[0].width,normal.before.tables[0].width);
  assert.equal(normal.after.tables[0].left,normal.before.tables[0].left);
  assert.equal(normal.after.tables[0].edges[0]-normal.before.tables[0].edges[0],60);
  const limit=await drag('container-limit', 0, 0, 420);
  assert.deepEqual(limit.after.tables[0].columns,[279,1,180]);
  assert.equal(limit.after.tables[0].width,limit.before.tables[0].width);
  await drag('escape', 0, 0, -40, true);
  const minimum = await drag('one-pixel-minimum', 0, 0, -400);
  assert.equal(minimum.after.tables[0].styles[0], '1px');
  await setup('fixed');
  await execute(`const paper=editor.view.dom.closest('.page');paper.style.transform='scale(.5)';paper.style.transformOrigin='top center'`);
  const zoom = await drag('zoom-50-percent', 0, 0, 30);
  assert.equal(zoom.after.tables[0].styles[0], '180px');
  await execute(`editor.view.dom.closest('.page').style.transform=''`);
  await setup('fixed');
  const outer=await drag('outer-centered-edge',0,2,30);
  assert.equal(outer.after.tables[0].width-outer.before.tables[0].width,60);
  assert.equal(outer.after.tables[0].right-outer.before.tables[0].right,30);
  await drag('outer-container-limit',0,2,420);
  await setup('nested');
  await drag('nested-container-limit', 1, 1, 300);
  await execute('editor.commands.configureEditorPagination({margins:{left:50,right:50}})');
  await until('layoutReady()&&!layout().error');
  report.margins = await execute('return widthMetrics()');
  assert.ok(report.margins.tables.every(table => table.width <= table.available));
  const beforeReopen = await execute('return widthMetrics()');
  await execute(`const stored=await db.chapters.get('fixture.1');setPages(false);editor.commands.setContent({type:'doc',content:[p('Remount table nodes')]},{emitUpdate:false});editor.commands.setContent({type:'doc',content:stored.content},{emitUpdate:false});setPages(true)`);
  await until('layoutReady()&&!layout().error');
  report.reopened = await execute('return widthMetrics()');
  assert.equal(report.reopened.source, beforeReopen.source);assert.deepEqual(report.reopened.tables, beforeReopen.tables);
  report.errors = await execute('return window.errors');assert.deepEqual(report.errors, []);
  await require('./editor-section-pdf.cjs').run(context, {
    cases: ux ? ['automatic'] : ['fixed','automatic','one-pixel','oversize','nested'], modes: ['both'],
    inputModule: '/tests/helpers/table-width-input.ts', inputFunction: 'tableWidthInput', reportName: 'cell-width-pdf.json',
    beforeCapture: ux ? async()=>{
      const automatic=await drag('automatic-full-width',0,0,60);
      assert.equal(automatic.after.tables[0].width,automatic.before.tables[0].width);
      assert.equal(automatic.after.tables[0].left,automatic.before.tables[0].left);
      report.clipboard=await execute(`
        const {ModelDOMParser}=await import('/tests/helpers/table-width-input.ts');
        const element=document.createElement('div');element.innerHTML=editor.getHTML();
        const parsed=ModelDOMParser.fromSchema(editor.schema).parse(element);
        const widths=doc=>{const result=[];doc.descendants(node=>{if(node.type.spec.tableRole==='cell'||node.type.spec.tableRole==='header_cell')result.push(node.attrs.colwidth)});return result};
        return {before:widths(editor.state.doc),after:widths(parsed)};
      `);
      assert.deepEqual(report.clipboard.after,report.clipboard.before,'HTML clipboard lost fractional widths');
    } : undefined,
  });
  const pdf=JSON.parse(fs.readFileSync(path.join(artifacts,'cell-width-pdf.json'),'utf8'));
  if(!ux)assert.ok(pdf.cases.find(item=>item.variant==='oversize').issues.some(issue=>issue.kind==='table'));
  fs.writeFileSync(path.join(artifacts,'cell-width-final.png'),(await win.webContents.capturePage()).toPNG());
  save();console.log('PASS cell-width regression:', artifacts);
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  process.env.HIGHTEX_TABLE_WIDTHS='1';process.env.HIGHTEX_EDITOR_PDF_PIPELINE='1';require('./editor-pagination.cjs');
}
