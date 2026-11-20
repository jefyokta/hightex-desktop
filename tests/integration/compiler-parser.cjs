// Removed editor nodes must fail safely in every legacy PDF entry point.
const assert = require("node:assert/strict");
const path = require("node:path");

exports.runParser = async ({ execute }) => {
  const result = await execute(`
    const {createLegacyDocumentParser}=await import('/src/compiler/parser.ts');
    const {StaticChapterBuilder}=await import('/src/compiler/builder/static-chapter-builder.ts');
    const {AttachmentBuilder}=await import('/src/compiler/builder/attachment-builder.ts');
    const {Document}=await import('/src/editor/document/index.ts');
    const {Chapter}=await import('/src/editor/chapter/chapter.ts');
    const {ChapterExtensions}=await import('/src/editor/chapter/chapter-extensions.ts');
    const CoreEditor=editor.constructor;
    const {events,getEditorChapter}=await import('/src/editor/event/index.ts');
    const active=Document.instance,current=Document.current,activeChapter=Chapter.instance;
    const editorBefore=JSON.stringify(editor.getJSON());
    const supported=[p('Literal <tag> & supported text'),makeTable(3)];
    const supportedBefore=JSON.stringify(supported),positive=document.createElement('section');
    createLegacyDocumentParser().render(supported,positive);
    const blocked=[{type:'blockquote',content:[p('Keep old source intact.'),makeTable(3)]}];
    const baseline=JSON.stringify(blocked),direct=document.createElement('section');
    let directRejected=false;
    try{createLegacyDocumentParser().render(blocked,direct)}catch(error){directRejected=error.message.includes('blockquote')}
    await db.chapters.put({id:'fixture.foreword',content:blocked});
    await db.chapters.put({id:'fixture.attachment',content:blocked});
    await db.chapters.put({id:'fixture.unsupported',content:blocked});
    const doc=await new Document('fixture').warm({activate:false,workspaceIdentity:false});
    const staticRoot=document.createElement('section');staticRoot.id='parser-static-test';document.body.append(staticRoot);
    class StaticFixture extends StaticChapterBuilder {selector='#parser-static-test';chapterId='foreword'}
    let staticRejected=false,attachmentRejected=false,editorRejected=false;
    const temporary=new CoreEditor({extensions:ChapterExtensions.contentSchema('1'),content:'',editable:false});
    try {
      try{await new StaticFixture().build(doc)}catch(error){staticRejected=error.message.includes('blockquote')}
      try{await AttachmentBuilder.create({parser:{mode:'full',document:doc},config:{parser:{mode:'full',document:doc}}})}catch(error){attachmentRejected=error.message.includes('blockquote')}
      const unsupported=new Chapter({chapter:'unsupported',documentId:'fixture',document:doc,isolated:true});
      try{await events.create({editor:temporary,chapter:unsupported})}catch(error){editorRejected=error.message.includes('blockquote')}
      await events.update({editor:temporary});
      return {
        supported:positive.textContent.includes('Literal <tag> & supported text')&&!positive.querySelector('tag')&&!!positive.querySelector('table'),
        noSchema:!temporary.schema.nodes.blockquote&&!temporary.commands.toggleBlockquote,
        directRejected,staticRejected,attachmentRejected,editorRejected,
        noPartialDOM:!direct.childNodes.length&&!staticRoot.childNodes.length,
        notEditable:!temporary.isEditable&&!getEditorChapter(temporary),
        preserved:baseline===JSON.stringify(blocked)&&supportedBefore===JSON.stringify(supported),
        stored:await Promise.all(['foreword','attachment','unsupported'].map(async id=>baseline===JSON.stringify((await db.chapters.get('fixture.'+id)).content))),
        activeUnchanged:Document.instance===active&&Document.current===current&&Chapter.instance===activeChapter&&JSON.stringify(editor.getJSON())===editorBefore,
      };
    }finally{temporary.destroy();staticRoot.remove()}
  `);
  for (const field of [
    "supported",
    "noSchema",
    "directRejected",
    "staticRejected",
    "attachmentRejected",
    "editorRejected",
    "noPartialDOM",
    "notEditable",
    "preserved",
    "activeUnchanged",
  ])
    assert.equal(result[field], true, field);
  assert.deepEqual(result.stored, [true, true, true]);
  console.log(
    "PASS: blockquotes are absent from the editor schema/commands; editor loading and normal/static/attachment PDF parsing reject them explicitly, preserving stored source and active editing context without partial output. Supported legacy content still renders.",
  );
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  process.env.HIGHTEX_COMPILER_PARSER = "1";
  require("./editor-pagination.cjs");
}
