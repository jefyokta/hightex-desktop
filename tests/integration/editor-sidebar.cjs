// Only the removed sidebar panels and their navigation/context-menu entry points.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
exports.run=async({execute,until,artifacts})=>{
  const report={};console.log('Sidebar artifacts:',artifacts);
  await execute(`
    setPages(false);await waitSaved();window.editor.sourceFile=async()=>undefined;window.application={isDev:false};
    const {tabs}=await import('/src/hooks/use-expandable-sidebar.tsx');
    const {editorGuides}=await import('/src/data/ui-guides/releases/1.2.0/editor.ts');
    window.sidebarKeys=Object.keys(tabs);
    window.sidebarGuides=editorGuides.every(guide=>guide.steps.every(step=>
      (!step.editor?.sidebar||sidebarKeys.includes(step.editor.sidebar))&&
      step.selectors.every(selector=>!selector.includes('editor-tab-previewer')&&!selector.includes('editor-chapter-list'))));
    window.mountApplication();
  `);
  await until('applicationEditor?.isEditable&&applicationChapter()==="fixture.1"');
  await execute('await waitSaved();window.sidebarSource=JSON.stringify(applicationEditor.getJSON());window.sidebarStored=JSON.stringify(await db.chapters.toArray())');
  assert.deepEqual(await execute('return sidebarKeys'),['citation','setting','variabl']);
  assert.equal(await execute('return sidebarGuides'),true);
  await execute(`document.querySelector('[data-tour="editor-sidebar"]').click()`);
  await until(`document.querySelector('[data-tour="editor-citation-library"]')`);
  report.tabs=await execute(`return Array.from(document.querySelectorAll('[data-tour^="editor-tab-"]'),button=>button.dataset.tour)`);
  assert.deepEqual(report.tabs,['editor-tab-citation','editor-tab-setting','editor-tab-variabl']);
  await execute(`document.querySelector('[data-tour="editor-tab-setting"]').click()`);
  await until(`document.querySelector('[data-tour="editor-document-settings"]')`);
  await execute(`document.querySelector('[data-tour="editor-tab-variabl"]').click()`);
  await until(`document.querySelector('[data-tour="editor-variables"]')`);
  await execute(`document.querySelector('[data-tour="editor-citation"]').click()`);
  await until(`document.querySelector('[data-tour="editor-citation-library"]')`);
  report.toolbarCitation=true;
  await execute(`document.querySelector('[data-chapter-picker-trigger]').click()`);
  await until(`document.querySelector('[data-chapter-picker] [cmdk-input]')`);
  report.picker=await execute(`return {chapter:document.querySelector('[data-chapter-picker]').textContent.includes('Introduction'),heading:document.querySelector('[data-chapter-picker]').textContent.includes('Metode Penelitian')}`);
  assert.deepEqual(report.picker,{chapter:true,heading:true});
  await execute(`document.querySelector('[data-chapter-picker]').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
  await until(`!document.querySelector('[data-chapter-picker]')`);
  await execute(`await window.config.set({language:'id'})`);
  await until(`document.querySelector('[data-tour="editor-tab-citation"]').textContent==='Sitasi'`);
  report.localized=await execute(`return Array.from(document.querySelectorAll('[data-tour^="editor-tab-"]'),button=>button.textContent)`);
  await execute(`const paragraph=applicationEditor.view.dom.querySelector('p'),box=paragraph.getBoundingClientRect();paragraph.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:box.left+20,clientY:box.top+10}))`);
  await until(`document.querySelector('[data-editor-context-menu]')`);
  report.contextMenu=await execute(`const {t}=await import('/src/utils/lang.ts');return {noPreview:!document.querySelector('[data-editor-context-menu]').textContent.includes(t('editor.context_menu.see_in_preview')),delete:document.querySelector('[data-editor-context-menu]').textContent.includes(t('editor.context_menu.delete'))}`);
  assert.deepEqual(report.contextMenu,{noPreview:true,delete:true});
  report.sourceUnchanged=await execute('return sidebarSource===JSON.stringify(applicationEditor.getJSON())&&sidebarStored===JSON.stringify(await db.chapters.toArray())');
  assert.equal(report.sourceUnchanged,true);
  report.noLegacyFrame=await execute(`return !document.querySelector('iframe,[data-tour="editor-chapter-list"],[data-tour="editor-tab-previewer"]')`);
  assert.equal(report.noLegacyFrame,true);
  report.errors=await execute('return errors');assert.deepEqual(report.errors,[]);report.complete=true;
  fs.writeFileSync(path.join(artifacts,'editor-sidebar.json'),JSON.stringify(report,null,2));
  console.log('PASS sidebar tools, toolbar navigation and context menu:',artifacts);
};
if(process.argv[1]&&path.resolve(process.argv[1])===__filename){process.env.HIGHTEX_EDITOR_SIDEBAR='1';require('./editor-pagination.cjs')}
