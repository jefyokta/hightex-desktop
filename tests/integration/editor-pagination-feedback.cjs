// Local UI verification: report IPC and clipboard are mocks in the host fixture.
const assert = require("node:assert/strict");
exports.runFeedback = async ({ execute, until, win }) => {
  const click = (selector) =>
    execute(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const fill = async (text) => {
    await execute(
      "document.querySelector('[data-pagination-feedback-details]').focus()",
    );
    await win.webContents.insertText(text);
    await until(
      `document.querySelector('[data-pagination-feedback-preview]').value.includes(${JSON.stringify(text)})`,
    );
  };
  const close = async () => {
    await execute(
      "document.querySelector('[data-pagination-feedback] [data-slot=dialog-close]').click()",
    );
    await until("!document.querySelector('[data-pagination-feedback]')");
  };
  await execute(
    "await document.fonts.ready;window.feedbackBaseline=JSON.stringify(editor.getJSON());setPages(true)",
  );
  await until(
    "layoutReady()&&!layout().error&&document.querySelector('[data-pagination-report]')",
  );
  // A resource/DOM-only reflow must advertise pending even with no model edit.
  await until("!document.querySelector('[data-pagination-measure]')");
  await execute(
    "editor.view.dom.querySelector('p').style.letterSpacing='0.01px'",
  );
  await until("!layoutReady()");
  await until(
    "layoutReady()&&!layout().error&&!document.querySelector('[data-pagination-measure]')",
  );
  assert.equal(
    await execute("return JSON.stringify(editor.getJSON())"),
    await execute("return feedbackBaseline"),
  );
  assert.equal(await execute("return feedbackTest.versionCalls"), 0);
  await click("[data-pagination-report]");
  await until(
    "document.querySelector('[data-pagination-feedback-preview]')?.value.includes('HighTex: 1.5.0')",
  );
  await close();
  assert.deepEqual(await execute("return feedbackTest.reports"), []);
  assert.deepEqual(await execute("return feedbackTest.copies"), []);
  await click("[data-pagination-report]");
  await fill("The heading moves after editing.");
  await until(
    "!document.querySelector('[data-pagination-feedback-copy]').disabled",
  );
  const reviewed = await execute(
    "return document.querySelector('[data-pagination-feedback-preview]').value",
  );
  assert(!reviewed.includes("Pagination fixture"));
  assert(!reviewed.includes("Penelitian ini"));
  await click("[data-pagination-feedback-copy]");
  await until("feedbackTest.copies.length===1");
  assert.equal(await execute("return feedbackTest.copies[0]"), reviewed);
  assert.deepEqual(await execute("return feedbackTest.reports"), []);
  await execute("feedbackTest.mode='failure'");
  await click("[data-pagination-feedback-send]");
  await until(
    "feedbackTest.reports.length===1&&!document.querySelector('[data-pagination-feedback-send]').disabled&&document.querySelector('[data-pagination-feedback-notice]')",
  );
  assert.equal(
    await execute(
      "return document.querySelector('[data-pagination-feedback-preview]').value",
    ),
    reviewed,
  );
  await execute("feedbackTest.mode='deferred'");
  await click("[data-pagination-feedback-send]");
  await until("feedbackTest.reports.length===2&&feedbackTest.resolve");
  await click("[data-pagination-feedback-send]");
  await execute(
    "document.querySelector('[data-pagination-feedback]').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}))",
  );
  assert.equal(
    await execute(
      "return !!document.querySelector('[data-pagination-feedback]')",
    ),
    true,
  );
  assert.equal(await execute("return feedbackTest.reports.length"), 2);
  assert.equal(
    await execute("return feedbackTest.reports[1].description"),
    reviewed,
  );
  await execute("feedbackTest.resolve()");
  await until(
    "document.querySelector('[data-pagination-feedback-details]').disabled&&!document.querySelector('[data-pagination-feedback-copy]').disabled",
  );
  await click("[data-pagination-feedback-copy]");
  await until("feedbackTest.copies.length===2");
  assert.equal(
    await execute(
      "return document.querySelector('[data-pagination-feedback-send]').disabled",
    ),
    true,
  );
  await close();
  assert.equal(
    await execute("return JSON.stringify(editor.getJSON())"),
    await execute("return feedbackBaseline"),
  );

  // Recovery commands change presentation only, and keep undo usable.
  await execute(
    "editor.commands.insertContentAt(editor.state.doc.content.size-1,'Recovery marker');window.recoveryEdited=JSON.stringify(editor.getJSON());failLayout()",
  );
  await until("document.querySelector('[data-pagination-retry]')");
  await click("[data-pagination-retry]");
  await until("layoutReady()&&!layout().error");
  assert.equal(
    await execute("return JSON.stringify(editor.getJSON())"),
    await execute("return recoveryEdited"),
  );
  await execute("failLayout()");
  await until("document.querySelector('[data-pagination-retry]')");
  await click("[data-pagination-disable]");
  await until(
    "!document.querySelector('.editor-pagination-sheet')&&!document.querySelector('[data-pagination-status]')",
  );
  assert.equal(
    await execute("return window.config.get().editor.pagination"),
    false,
  );
  assert.equal(
    await execute("return JSON.stringify(editor.getJSON())"),
    await execute("return recoveryEdited"),
  );
  await execute("editor.commands.undo();await waitSaved()");
  assert.equal(
    await execute("return JSON.stringify(editor.getJSON())"),
    await execute("return feedbackBaseline"),
  );

  // Report remains available with page view off; nested Escape retains Settings.
  await execute("window.mountApplication()");
  await until(
    "window.applicationEditor?.isEditable&&document.querySelector('[data-tour=editor-settings-trigger]')",
  );
  await click("[data-tour=editor-settings-trigger]");
  await until(
    "document.querySelector('[data-tour=editor-pagination-setting] [data-pagination-report]')",
  );
  await execute("feedbackTest.versionFails=true");
  await click("[data-tour=editor-pagination-setting] [data-pagination-report]");
  await fill("Offline draft.");
  await until(
    "!document.querySelector('[data-pagination-feedback-copy]').disabled",
  );
  assert(
    (
      await execute(
        "return document.querySelector('[data-pagination-feedback-preview]').value",
      )
    ).includes("HighTex: unknown"),
  );
  assert(
    (
      await execute(
        "return document.querySelector('[data-pagination-feedback-preview]').value",
      )
    ).includes("disabled"),
  );
  await click("[data-pagination-feedback-copy]");
  await until("feedbackTest.copies.length===3");
  await execute(
    "document.querySelector('[data-pagination-feedback]').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}))",
  );
  await until("!document.querySelector('[data-pagination-feedback]')");
  assert.equal(
    await execute(
      "return !!document.querySelector('[data-tour=editor-pagination-setting]')",
    ),
    true,
  );
  assert.equal(
    await execute("return window.config.get().editor.pagination"),
    false,
  );
  assert.equal(await execute("return feedbackTest.reports.length"), 2);
  assert.deepEqual(await execute("return errors"), []);
  console.log(
    "PASS: reviewed/copy-only feedback, explicit mocked send, failure/retry, duplicate guard, offline draft, nested dialogs, recovery/disable/undo; no actual reports sent.",
  );
};
