// Runs from editor-rendering.cjs against the same real editor and isolated DB.
const assert = require("node:assert/strict");

exports.runReferences = async ({ execute, until }) => {
  await execute(`
    const {Document}=await import('/src/editor/document/index.ts');
    const {Chapter}=await import('/src/editor/chapter/chapter.ts');
    window.referenceDocument=Document.instance;
    const equation=id=>({type:'blockMath',attrs:{id,latex:'x^2'}});
    const heading=id=>({type:'heading',attrs:{id,level:1},content:[{type:'text',text:id}]});
    const table=makeTable(3);table.attrs={id:'appendix-table',figureId:'appendix-table-figure'};
    await db.chapters.put({id:'fixture.2',content:[heading('chapter-two'),equation('remote-equation')]});
    await db.chapters.put({id:'fixture.attachment',content:[heading('appendix-a'),heading('appendix-b'),table,equation('appendix-equation')]});
    // Retained content of a generated/frozen chapter must not affect numbering.
    await db.chapters.put({id:'fixture.cv',content:[equation('unused-frozen-equation')]});
    const second=new Chapter({documentId:'fixture',document:referenceDocument,chapter:'2',isolated:true});
    referenceDocument.chapters.splice(referenceDocument.chapters.findIndex(chapter=>chapter.getChapter()==='attachment'),0,second);
    await second.graph.sync();
    await referenceDocument.chapters.find(chapter=>chapter.getChapter()==='attachment').graph.sync();
    window.referenceSource={type:'doc',content:[editor.getJSON().content[0],equation('local-equation-one'),equation('local-equation-two'),
      {type:'paragraph',attrs:{id:'reference-check'},content:[
        {type:'refComponent',attrs:{ref:'equation',link:'local-equation-two'}},
        {type:'text',text:' / '},{type:'refComponent',attrs:{ref:'equation',link:'remote-equation'}},
        {type:'text',text:' / '},{type:'refComponent',attrs:{ref:'equation',link:'appendix-equation'}},
        {type:'text',text:' / '},{type:'refComponent',attrs:{ref:'head',link:'appendix-b'}},
        {type:'text',text:' / '},{type:'refComponent',attrs:{ref:'figureTable',link:'appendix-table'}},
      ]},
    ]};
    await prepareComparison(referenceSource);editor.commands.setContent(referenceSource);await waitSaved();await prepareComparison(editor.getJSON());
    const {Exporter}=await import('/src/utils/htx/exporter.ts');const {readImportModel}=await import('/src/utils/htx/import-model.ts');
    window.referenceModel=readImportModel((await new Exporter('fixture').buildExport()).buffer);
    // The export host must supply the same chapter order as the live document.
    const order=referenceDocument.chapters.map(chapter=>chapter.getChapter());
    referenceModel.chapters.sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id));
    window.referenceModelBefore=JSON.stringify(referenceModel);
    window.referenceSourceBefore=JSON.stringify(editor.getJSON());
    window.referenceStoredBefore=JSON.stringify(await db.chapters.toArray());
    window.referenceUpdatesBefore=updates;
    window.referenceTargets=['local-equation-two','remote-equation','appendix-equation','appendix-b','appendix-table'];
    window.referenceLabels=()=>referenceTargets.map(target=>document.querySelector('#reference-check [data-link="'+target+'"]').textContent);
  `);
  for (const language of ["en", "id"]) {
    await execute(
      `await window.config.set({language:${JSON.stringify(language)}})`,
    );
    // Both UI locales intentionally retain Indonesian thesis reference labels.
    const expected = [
      "Persamaan 2",
      "Persamaan 3",
      "Persamaan 4",
      "Lampiran B",
      "Tabel B.1",
    ];
    await until(
      `JSON.stringify(referenceLabels())===${JSON.stringify(JSON.stringify(expected))}`,
    );
    await until(
      "document.querySelector('#local-equation-two')?.textContent.includes('(2)')",
    );
    const result = await execute(`
      const {Document}=await import('/src/editor/document/index.ts');
      const {Chapter}=await import('/src/editor/chapter/chapter.ts');
      const root=document.createElement('section');
      const nodes=referenceModel.chapters.find(chapter=>chapter.id==='1').content;
      const rendered=renderChapterContent(root,referenceModel,nodes,'1');
      try {
        const labels=Array.from(root.querySelectorAll('[data-type=ref-component]'),link=>link.textContent);
        const anchors=['local-equation-one','local-equation-two'].map(id=>root.querySelector('#'+id+'[data-latex]')?.id);
        const numbers=Array.from(root.querySelectorAll('[data-equation-number]'),element=>element.textContent);
        const destinations=[];
        for(const chapter of referenceModel.chapters.filter(chapter=>['2','attachment'].includes(chapter.id))) {
          const target=document.createElement('section');const view=renderChapterContent(target,referenceModel,chapter.content,chapter.id);
          try{destinations.push(...Array.from(target.querySelectorAll('[id]'),element=>element.id))}finally{view.dispose()}
        }
        const bad=document.createElement('section');
        const invalid=renderChapterContent(bad,referenceModel,[{type:'paragraph',content:[{type:'refComponent',attrs:{ref:'imageFigure',link:'remote-equation'}},{type:'refComponent',attrs:{ref:'__proto__',link:'appendix-b'}}]},{type:'blockMath',attrs:{latex:'x',id:'unknown-equation'}}],'1');
        const rejectsWrongKinds=invalid.issues.filter(issue=>issue.kind==='reference'&&issue.key!=='unknown-equation').length===2&&JSON.stringify(Array.from(bad.querySelectorAll('a'),link=>link.textContent))===JSON.stringify(['Gambar ?','Referensi ?']);
        const rejectsMissingEquation=invalid.issues.some(issue=>issue.kind==='reference'&&issue.key==='unknown-equation')&&!bad.querySelector('[data-equation-number]');invalid.dispose();
        return {issues:rendered.issues,labels,editorLabels:referenceLabels(),anchors,numbers,
          remoteAnchors:['remote-equation','appendix-equation','appendix-b','appendix-table'].every(id=>destinations.includes(id)),
          rejectsWrongKinds,rejectsMissingEquation,
          modelUnchanged:JSON.stringify(referenceModel)===referenceModelBefore,
          sourceUnchanged:JSON.stringify(editor.getJSON())===referenceSourceBefore,
          storageUnchanged:JSON.stringify(await db.chapters.toArray())===referenceStoredBefore,
          noUpdates:updates===referenceUpdatesBefore,
          contextUnchanged:Document.instance===referenceDocument&&Document.current?.getChapter()==='1'&&Chapter.instance?.getChapter()==='1',
        };
      }finally{rendered.dispose()}
    `);
    assert.deepEqual(result.issues, []);
    assert.deepEqual(result.labels, expected, language);
    assert.deepEqual(result.labels, result.editorLabels);
    assert.deepEqual(result.anchors, [
      "local-equation-one",
      "local-equation-two",
    ]);
    assert.deepEqual(result.numbers, ["(1)", "(2)"]);
    for (const key of [
      "remoteAnchors",
      "rejectsWrongKinds",
      "rejectsMissingEquation",
      "modelUnchanged",
      "sourceUnchanged",
      "storageUnchanged",
      "noUpdates",
      "contextUnchanged",
    ])
      assert.equal(result[key], true, key);
  }
  console.log(
    "PASS: live and snapshot equation/appendix/table references match across chapters in English and Indonesian; global equation numbers and source anchors survive; wrong reference kinds are rejected; source/storage/context remain unchanged.",
  );
};
