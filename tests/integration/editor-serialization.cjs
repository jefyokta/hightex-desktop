// Reuse the actual editor schema; no app build, alternate parser or PDF promotion.
const assert = require("node:assert/strict");
const path = require("node:path");

exports.runSerialization = async ({ execute, until }) => {
  await execute(`
    window.serializationSource={type:'doc',content:[editor.getJSON().content[0],
      {type:'paragraph',attrs:{id:'serializer-paragraph'},content:[{type:'text',text:'Layered <tag> & text',marks:[{type:'bold'},{type:'italic'},{type:'underline'},{type:'strike'}]}]},
      {type:'orderedList',attrs:{start:7},content:[
        {type:'listItem',content:[p('First item.'),
          {type:'orderedList',attrs:{start:3},content:[{type:'listItem',content:[p('Nested item.')]}]},
        ]},
        {type:'listItem',content:[p('Next item.')]},
      ]},
      makeTable(4),{type:'horizontalRule'},p(sentence.repeat(40)),
    ]};
    editor.commands.setContent(serializationSource);await waitSaved();
    window.serializationBaseline=JSON.stringify(editor.getJSON());
  `);
  const initial = await execute(`
    const {ChapterExtensions}=await import('/src/editor/chapter/chapter-extensions.ts');
    const {Document}=await import('/src/editor/document/index.ts');
    window.chapterSerializer=ChapterExtensions;
    const active=Document.instance,current=Document.current;
    const before=JSON.stringify(await db.chapters.get('fixture.1')),updatesBefore=updates;
    const original=legacyParserClass.prototype.render;
    let legacyCalls=0;
    legacyParserClass.prototype.render=function(){legacyCalls++;throw Error('Legacy parser must not serialize editor content')};
    try {
      const html=ChapterExtensions.serializeContent('1',editor.getJSON().content);
      const root=document.createElement('section');root.innerHTML=html;
      window.serializationHTML=html;
      const noteSource=[{type:'paragraph',content:[{type:'text',text:'Literal note <script>',marks:[{type:'note',attrs:{note:'Note <tag> & detail'}}]}]}];
      const noteBefore=JSON.stringify(noteSource),notes=document.createElement('section');
      notes.innerHTML=ChapterExtensions.serializeContent('foreword',noteSource);
      const atoms=document.createElement('section');
      atoms.innerHTML=ChapterExtensions.serializeContent('attachment',[
        {type:'paragraph',content:[{type:'cite',attrs:{cite:citeKey}},{type:'variable',attrs:{name:'title'}},{type:'mathInline',attrs:{latex:'x^2'}},{type:'refComponent',attrs:{ref:'imageFigure',link:'figure-target'}}]},
        {type:'imageFigure',attrs:{id:'image-caption',figureId:'figure-target'},content:[{type:'image',attrs:{src:'fixture-image',width:300}},{type:'figcaption',content:[{type:'text',text:'Figure caption.'}]}]},
        {type:'blockMath',attrs:{id:'equation',latex:'E=mc^2'}},
      ]);
      let rejectsUnknown=false;
      try{ChapterExtensions.serializeContent('1',[{type:'unknown-editor-node'}])}catch{rejectsUnknown=true}
      let rejectsQuote=false;
      try{ChapterExtensions.serializeContent('1',[{type:'blockquote',content:[p('Keep this old source intact.')]}])}catch{rejectsQuote=true}
      return {
        matchesEditorHTML:html===editor.getHTML(),
        marks:['strong','em','u','s'].every(tag=>root.querySelector('#serializer-paragraph '+tag)?.textContent==='Layered <tag> & text'),
        listStarts:Array.from(root.querySelectorAll('ol'),list=>list.start),
        table:root.querySelectorAll('figure[data-type=figureTable] table tr').length,
        noInjectedTags:!root.querySelector('tag')&&!notes.querySelector('script'),
        note:notes.querySelector('abbr')?.title==='Note <tag> & detail'&&notes.textContent==='Literal note <script>',
        noteSourceUnchanged:JSON.stringify(noteSource)===noteBefore,
        rawAtoms:!!atoms.querySelector('cite[cite]')&&!!atoms.querySelector('[data-variable]')&&!!atoms.querySelector('[data-math-inline]')&&!!atoms.querySelector('[data-type=ref-component]'),
        unresolvedImage:atoms.querySelector('img')?.getAttribute('data-image-id')==='fixture-image'&&!atoms.querySelector('img')?.getAttribute('src'),
        noButtons:!root.querySelector('button'),
        rejectsUnknown,rejectsQuote,noQuote:!editor.schema.nodes.blockquote&&!editor.commands.toggleBlockquote,legacyCalls,
        sourceUnchanged:JSON.stringify(editor.getJSON())===serializationBaseline,
        storageUnchanged:JSON.stringify(await db.chapters.get('fixture.1'))===before,
        noUpdates:updates===updatesBefore,
        activeContextUnchanged:Document.instance===active&&Document.current===current,
      };
    }finally{legacyParserClass.prototype.render=original}
  `);
  for (const key of [
    "matchesEditorHTML",
    "marks",
    "noInjectedTags",
    "note",
    "noteSourceUnchanged",
    "rawAtoms",
    "unresolvedImage",
    "noButtons",
    "rejectsUnknown",
    "rejectsQuote",
    "noQuote",
    "sourceUnchanged",
    "storageUnchanged",
    "noUpdates",
    "activeContextUnchanged",
  ])
    assert.equal(initial[key], true, key);
  assert.deepEqual(initial.listStarts, [7, 3]);
  assert.equal(initial.table, 4);
  assert.equal(initial.legacyCalls, 0);
  await execute("window.setPages(true)");
  await until(
    "layoutReady()&&!layout().error&&!document.querySelector('[data-pagination-measure]')",
  );
  const paginated = await execute(`
    const html=chapterSerializer.serializeContent('1',editor.getJSON().content);
    return {same:html===serializationHTML,noFurniture:!html.includes('editor-pagination')&&!html.includes('data-editor-page-break'),unchanged:JSON.stringify(editor.getJSON())===serializationBaseline};
  `);
  assert.deepEqual(paginated, {
    same: true,
    noFurniture: true,
    unchanged: true,
  });
  console.log(
    "PASS: editor-schema HTML preserves combined marks, nested lists, tables and notes, rejects removed blockquotes without data loss, excludes pagination/UI furniture, never calls the legacy parser and never mutates source/storage/context. Atom/resource hydration remains explicit.",
  );
};
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  process.env.HIGHTEX_EDITOR_SERIALIZATION = "1";
  require("./editor-pagination.cjs");
}
