// Opt-in real local archives → isolated editor, experimental engine and native PDF.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { PDFDocument } = require("pdf-lib");
const { prepare } = require("./local-archives.cjs");
const { containsPDFSourceText } = require("./page-plan-pdf.cjs");
exports.prepare = ({ artifacts, reproduce }) => {
  const inputs = prepare({ artifacts });
  return {
    serve: inputs.serve,
    async run({ execute, until, editorPDFTest, win }) {
      assert(
        editorPDFTest,
        "The real experimental PDF service must be installed",
      );
      const report = {
        documents: [],
        originalArchivesUnchanged: false,
        network: "external requests blocked",
        scope:
          "local archive imports, editor snapshot, separated document engine, actual experimental PDF service, native text/page checks",
      };
      const save = () =>
        fs.writeFileSync(
          path.join(artifacts, "archive-engine-report.json"),
          JSON.stringify(report, null, 2),
        );
      const filter = process.env.HIGHTEX_PAGINATION_DOCUMENT_FILTER?.split(",");
      const selected = inputs.files.filter(
        (file) => !filter || filter.includes(file.label),
      );
      fs.writeFileSync(
        path.join(artifacts, "private-input-map.json"),
        JSON.stringify(
          inputs.files.map(({ label, source, originalHash }) => ({
            label,
            source,
            originalHash,
          })),
          null,
          2,
        ),
      );
      console.log("Private archive engine artifacts:", artifacts);
      save();
      await execute(`
      const {parseCategoryDirectory}=await import('/src/utils/category-directory.ts');
      const categories=parseCategoryDirectory(await (await fetch('/document-test/categories')).json());
      window.hightex.categories=async()=>structuredClone(categories);
      window.archiveImporter=(await import('/src/utils/import-v2.ts')).HighTexImporter;
      window.archiveStorage=(await import('/src/editor/storage/index.ts')).Storage.instance;
      window.archiveEvents=(await import('/src/editor/event/index.ts')).events;
      window.archiveDocument=(await import('/src/editor/document/index.ts')).Document;
      window.emptyArchiveProfile=(await import('/src/utils/author-profile.ts')).emptyAuthorProfile;
      window.archiveProfileInvalidate=(await import('/src/utils/document-profile.ts')).invalidateWorkspaceAuthorProfile;
      window.archiveCapture=(await import('/src/document-export/capture.ts')).captureDocumentPDF;
      window.archivePageSamples=(await import('/tests/helpers/document-page-samples.ts')).documentPageSamples;
      window.archivePaginationKey=(await import('/src/editor/pagination/index.ts')).paginationKey;
      window.archiveInitialState=editor.state;
      window.archiveFixture=(await import('/src/editor/event/index.ts')).getEditorChapter(editor);
      window.archiveSavedSource=async id=>JSON.stringify({document:await db.documents.get(id),chapters:await db.chapters.where('id').startsWith(id+'.').sortBy('id')});
    `);
      if (reproduce) {
        try {
          await reproduce({ execute, until, editorPDFTest, win, artifacts, files: selected, importArchive });
        } finally {
          report.scope = "delegated local discovery/calibration; see its own report for outcome";
          report.originalArchivesUnchanged = inputs.unchanged();
          save();
          assert.equal(report.originalArchivesUnchanged, true, "Original archive changed");
        }
        return;
      }
      for (const file of selected) {
        const result = {
          label: file.label,
          archiveSha256: file.originalHash,
          stage: "import",
          trace: [],
        };
        report.documents.push(result);
        save();
        console.log("Archive engine:", file.label, "import");
        try {
          const imported = await importArchive(execute, file);
          result.category = imported.category;
          result.variant = imported.variant;
          result.chapters = imported.chapters;
          result.identityRepairs = imported.identityRepairs;
          result.stage = "capture";
          save();
          const start = Date.now();
          const captured = await execute(`
          const task=new AbortController();const timer=setTimeout(()=>task.abort(new Error('Archive capture deadline')),90000);
          try{
            window.archiveSnapshot=await archiveCapture(archiveContext,task.signal,engine=>{
              for(const type of ['start','section.before','section.after','chapter','contentRendered','index.pass','rendered','error','cancel'])engine.events.on(type,event=>{
                archiveTrace.push({type,runId:event.runId,sequence:event.sequence,phase:event.phase,chapterId:event.chapterId,changed:event.changed,stable:event.stable,sectionId:event.sectionId,kind:event.section?.kind??event.sectionKind,stage:event.stage,pass:event.pass,pages:event.pages});
                if(type==='rendered'){
                  window.archiveSampling=archivePageSamples(engine.documentPages);
                  archiveSamples.push(...archiveSampling.samples);archiveCaptions.push(...archiveSampling.captions);
                }
              });
            });
            return {ok:true,pages:archiveSnapshot.pages,sections:archiveSnapshot.sections,trace:archiveTrace,samples:archiveSamples,captions:archiveCaptions,sampling:archiveSampling,portable:!archiveSnapshot.html.includes('blob:'),bytes:archiveSnapshot.html.length,sourceUnchanged:archiveBefore===await archiveSavedSource(archiveContext.id)};
          }catch(error){return {ok:false,message:error.message,code:error.code,level:error.level,details:error.cause?.details??error.details,stack:error.stack,diagnostic:error.diagnostic,description:error.description,trace:archiveTrace,sourceUnchanged:archiveBefore===await archiveSavedSource(archiveContext.id)}}
          finally{clearTimeout(timer)}
        `);
          result.captureMs = Date.now() - start;
          result.trace = captured.trace;
          result.sourceUnchanged = captured.sourceUnchanged;
          assert.equal(
            result.sourceUnchanged,
            true,
            "Capture changed the imported draft",
          );
          if (!captured.ok) {
            result.error = captured.message;
            result.code = captured.code;
            result.level = captured.level;
            result.details = captured.details;
            result.diagnostic = captured.diagnostic;
            result.stack = captured.stack;
            result.stage = "capture-failed";
            console.log(
              "Archive engine:",
              file.label,
              "capture failed",
              captured.diagnostic?.sectionId ?? "input",
            );
            save();
            continue;
          }
          result.pages = captured.pages;
          result.sections = captured.sections;
          result.snapshotBytes = captured.bytes;
          assert.equal(captured.portable, true);
          assert.ok(captured.sampling.contexts>0 && captured.samples.length>0, 'No editable source was sampled; native text proof would be empty');
          assert.equal(captured.samples.length,captured.sampling.textPages,'An eligible source page was not sampled');
          result.stage = "native-pdf";
          save();
          await execute(
            "await window.editorPDFExperimental.export(archiveSnapshot,crypto.randomUUID())",
          );
          const output = editorPDFTest.outputs.at(-1),
            pdf = await PDFDocument.load(fs.readFileSync(output));
          result.nativePages = pdf.getPageCount();
          assert.equal(
            pdf.getPageCount(),
            captured.pages,
            "Native PDF page count changed",
          );
          const extracted = execFileSync(
            "pdftotext",
            ["-layout", output, "-"],
            { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
          ).split("\f");
          fs.writeFileSync(
            path.join(artifacts, file.label + "-samples.json"),
            JSON.stringify(captured.samples, null, 2),
          );
          fs.writeFileSync(
            path.join(artifacts, file.label + "-captions.json"),
            JSON.stringify(captured.captions, null, 2),
          );
          const rawText = execFileSync("pdftotext", ["-raw", output, "-"], {
              encoding: "utf8",
              maxBuffer: 32 * 1024 * 1024,
            }),
            raw = rawText.split("\f");
          fs.writeFileSync(
            path.join(artifacts, file.label + "-raw.txt"),
            rawText,
          );
          fs.writeFileSync(
            path.join(artifacts, file.label + "-bbox.html"),
            execFileSync("pdftotext", ["-bbox-layout", output, "-"], {
              encoding: "utf8",
              maxBuffer: 32 * 1024 * 1024,
            }),
          );
          const audit = captured.samples.map((sample) => ({
            page: sample.page,
            length: sample.text.length,
            match: containsPDFSourceText(
              sample.text,
              extracted[sample.page - 1] ?? "",
            )
              ? "layout"
              : containsPDFSourceText(sample.text, raw[sample.page - 1] ?? "")
                ? "raw"
                : "missing",
          }));
          fs.writeFileSync(
            path.join(artifacts, file.label + "-text-audit.json"),
            JSON.stringify(audit, null, 2),
          );
          const bad = captured.samples.filter(
            (sample) =>
              !containsPDFSourceText(
                sample.text,
                extracted[sample.page - 1] ?? "",
                raw[sample.page - 1] ?? "",
              ),
          );
          result.extractionReorderedSamples = audit.filter(
            (sample) => sample.match === "raw",
          ).length;
          result.samples = captured.samples.length;
          result.failedSamples = bad.map((sample) => ({
            page: sample.page,
            length: sample.text.length,
          }));
          if (bad.length)
            fs.writeFileSync(
              path.join(artifacts, file.label + "-text-mismatches.json"),
              JSON.stringify(
                bad.map((sample) => ({
                  ...sample,
                  extracted: extracted[sample.page - 1] ?? "",
                })),
                null,
                2,
              ),
            );
          assert.equal(
            bad.length,
            0,
            "Native PDF lost or reassigned sampled editor text",
          );
          assert.ok(
            captured.captions.every((caption) =>
              caption.before.includes(caption.label),
            ),
            "Caption CSS replaced its computed label",
          );
          assert.ok(
            captured.captions.every((caption) =>
              containsPDFSourceText(
                caption.label,
                extracted[caption.page - 1] ?? "",
                raw[caption.page - 1] ?? "",
              ),
            ),
            "Native PDF changed a computed caption label",
          );
          result.captions = captured.captions.length;
          fs.copyFileSync(output, path.join(artifacts, file.label + ".pdf"));
          result.stage = "passed";
          console.log(
            "Archive engine:",
            file.label,
            "PASS",
            result.pages,
            "pages",
            result.samples,
            "text samples",
          );
        } catch (error) {
          result.error = error.message;
          result.stack = error.stack;
          result.stage += "-failed";
          console.log("Archive engine:", file.label, "failed at", result.stage);
        } finally {
          save();
          await execute(`
        if(window.archiveContext){await archiveStorage.waitForDocument(archiveContext.id);archiveContext.destroy()}
        archiveDocument.setCurrentChapter(archiveFixture);editor.view.updateState(archiveInitialState);
        window.archiveSnapshot=undefined;
      `).catch(() => {});
        }
      }
      report.originalArchivesUnchanged = inputs.unchanged();
      save();
      assert.equal(
        report.originalArchivesUnchanged,
        true,
        "Original archive changed",
      );
      const failed = report.documents.filter(
        (document) => document.stage !== "passed",
      );
      console.log(
        "Archive engine summary:",
        report.documents.length - failed.length,
        "passed,",
        failed.length,
        "failed; originals unchanged",
      );
      assert.equal(
        failed.length,
        0,
        "Real archives exposed engine failures; inspect the private archive-engine-report.json",
      );
    },
  };
};
async function importArchive(execute, file) {
  return execute(`
          const bytes=await(await fetch('/document-test/${file.label}')).arrayBuffer();
          const importer=await archiveImporter.create(new File([bytes],'local-test.hightex'),'local-test.hightex');
          window.profile.get=async()=>({...emptyArchiveProfile(),...importer.model.profile,isCloud:false});
          window.profile.picture=async()=>importer.model.profilePicture?.bytes??false;archiveProfileInvalidate();
          const data=await importer.import('copy');
          const beforeEditing=new Map((await db.chapters.where('id').startsWith(data.id+'.').toArray()).map(chapter=>[chapter.id,JSON.stringify(chapter.content)]));
          window.archiveContext=await new archiveDocument(data.id).warm({workspaceIdentity:false,forEditing:true});
          const identityRepairs=(await db.chapters.where('id').startsWith(data.id+'.').toArray()).filter(chapter=>beforeEditing.has(chapter.id)&&beforeEditing.get(chapter.id)!==JSON.stringify(chapter.content)).length;
          window.archiveBefore=await archiveSavedSource(data.id);window.archiveTrace=[];window.archiveSamples=[];window.archiveCaptions=[];
          return {id:data.id,category:archiveContext.category.id,variant:archiveContext.category.variant,chapters:importer.model.chapters.length,identityRepairs};
        `);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  process.env.HIGHTEX_EDITOR_PDF_PIPELINE = "1";
  process.env.HIGHTEX_EDITOR_PDF_ARCHIVES = "1";
  require("./editor-pagination.cjs");
}
