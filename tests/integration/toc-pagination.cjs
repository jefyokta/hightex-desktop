// Isolated renderer check, without application data or a backend.
// env -u ELECTRON_RUN_AS_NODE node_modules/.bin/electron tests/integration/toc-pagination.cjs
const { app, BrowserWindow } = require("electron");
const { readFileSync, writeFileSync, mkdtempSync } = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const ts = require("typescript");
const root = path.resolve(__dirname, "../..");
const artifacts = mkdtempSync(path.join(os.tmpdir(), "hightex-toc-"));
app.setPath("userData", artifacts);
app.commandLine.appendSwitch("disable-gpu");
const timeout = setTimeout(() => app.exit(1), 60000);
let win;

app
  .whenReady()
  .then(async () => {
    win = new BrowserWindow({
      show: false,
      width: 1000,
      height: 1200,
      webPreferences: { backgroundThrottling: false },
    });
    const execute = (code) => win.webContents.executeJavaScript(code);
    const css = ["document", "toc"]
      .map((name) =>
        readFileSync(path.join(root, `src/css/${name}.css`), "utf8").replace(
          /^@import.*$/gm,
          "",
        ),
      )
      .join("\n");
    await win.loadURL("about:blank");
    await execute(`document.head.innerHTML = '<style></style>';
    document.querySelector('style').textContent = ${JSON.stringify(css)};
    document.body.style.cssText = 'font:12pt "Times New Roman";background:white';
    void 0;`);
    const builder = ts.transpileModule(
      readFileSync(
        path.join(root, "src/compiler/builder/toc-builder.ts"),
        "utf8",
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
        },
      },
    ).outputText;
    await execute(
      `const exports = {}; ${builder}; window.TocBuilder = TocBuilder; void 0;`,
    );
    const recount = ts.transpileModule(
      readFileSync(
        path.join(root, "src/compiler/handlers/recount-page.ts"),
        "utf8",
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
        },
      },
    ).outputText;
    await execute(`${recount}; window.RecountPage = exports.default; void 0;`);
    await execute(
      readFileSync(
        path.join(root, "node_modules/pagedjs/dist/paged.js"),
        "utf8",
      ) + ";void 0;",
    );
    const result = await execute(`(async () => {
    const source = document.createElement('div');
    source.style.display = 'none';
    document.body.append(source);
    source.innerHTML = '<section class="introduction"><h1 id="foreword">KATA PENGANTAR</h1><h1 id="tot">DAFTAR TABEL</h1><h1 id="tof">DAFTAR GAMBAR</h1><h1 id="toa">DAFTAR SINGKATAN</h1></section><section class="content"></section><section class="biblio"><h1 id="biblio">DAFTAR PUSTAKA</h1></section><section class="attachment"><div id="attachment">LAMPIRAN</div></section>';
    const chapters = source.querySelector('.content');
    const expected = new Map();
    for (let i = 0; i < 72; i++) {
      const level = i === 0 ? 1 : i % 3 === 0 ? 2 : 3;
      const heading = document.createElement('h' + level);
      heading.id = 'chapter-heading-' + i;
      heading.dataset.numbering = level === 1 ? '1' : level === 2 ? '1.' + i : '1.' + i + '.1';
      heading.textContent = i === 0 ? 'PENDAHULUAN' : i % 4 === 0
        ? 'Judul subbab yang panjang untuk memastikan nomor dan judul tetap utuh ketika daftar isi melewati batas halaman ' + i
        : level === 2 ? 'Latar Belakang ' + i : 'Rincian Permasalahan ' + i;
      chapters.append(heading);
      expected.set(heading.id, heading.dataset.numbering);
    }
    const toc = TocBuilder.create({ root: chapters });
    source.insertBefore(toc, source.firstChild);
    const seeded = [...toc.querySelectorAll('[data-heading-id]')]
      .filter(row => expected.has(row.dataset.headingId))
      .every(row => row.querySelector('.toc-number')?.textContent === expected.get(row.dataset.headingId));
    const fragment = document.createDocumentFragment();
    const clone = document.createElement('div');
    clone.innerHTML = source.innerHTML;
    fragment.append(clone);
    const rendered = document.createElement('div');
    document.body.append(rendered);
    await document.fonts.ready;
    await new Paged.Previewer({ auto: false }).preview(fragment, undefined, rendered);
    new RecountPage().afterRendered();
    chapters.remove();
    await TocBuilder.assignPageNumbers();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const rect = element => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width };
    };
    const rows = [...rendered.querySelectorAll('.toc .toc-row')].map(row => {
      const number = row.querySelector('.toc-number');
      const text = row.querySelector('.toc-text');
      const range = document.createRange();
      if (number) range.selectNodeContents(number);
      return { id: row.dataset.headingId, expected: expected.get(row.dataset.headingId),
        number: number?.textContent, numberBox: rect(number), numberInk: number ? rect(range) : null,
        text: rect(text), row: rect(row), page: rect(row.querySelector('.toc-page')),
        level: row.classList.contains('subsub') ? 3 : row.classList.contains('sub') ? 2 : 1,
        dots: row.querySelector('.toc-dots')?.textContent.length ?? 0 };
    });
    return { seeded, rows, tocPages: rendered.querySelectorAll('.pagedjs_page:has(.toc)').length,
      expected: Object.fromEntries(expected) };
  })()`);
    assert.equal(
      result.seeded,
      true,
      "chapter numbers must exist before pagination",
    );
    assert.ok(result.tocPages > 1, "fixture must span several TOC pages");
    for (const [id, number] of Object.entries(result.expected)) {
      const rows = result.rows.filter((row) => row.id === id);
      assert.equal(rows.length, 1, `${id}: TOC entry split across pages`);
      const row = rows[0];
      assert.equal(row.number, number, `${id}: left number missing`);
      assert.ok(
        row.numberBox.top < row.text.bottom &&
          row.numberBox.bottom > row.text.top,
        `${id}: number and title must share a line`,
      );
      assert.ok(
        row.text.left - row.numberInk.right >= 7.9,
        `${id}: number overlaps title`,
      );
      assert.ok(row.dots > 0, `${id}: missing leader`);
    }
    for (const level of [1, 2, 3]) {
      const rows = result.rows.filter(
        (row) => row.level === level && row.expected,
      );
      const offsets = rows.map((row) => row.text.left - row.row.left);
      assert.ok(
        offsets.every((offset) => Math.abs(offset - offsets[0]) < 0.1),
        `level ${level}: title columns must stay aligned across pages`,
      );
      const gaps = rows.map((row) => row.text.left - row.numberInk.right);
      assert.ok(
        Math.min(...gaps) <= 8.1,
        `level ${level}: excess gap after longest number`,
      );
    }
    writeFileSync(
      path.join(artifacts, "toc.png"),
      (await win.webContents.capturePage()).toPNG(),
    );
    console.log(
      JSON.stringify({
        tocPages: result.tocPages,
        numberedEntries: Object.keys(result.expected).length,
        numbersPreserved: true,
        alignedColumns: true,
        artifacts,
      }),
    );
    clearTimeout(timeout);
    win.destroy();
    app.exit(0);
  })
  .catch((error) => {
    console.error(error);
    win?.destroy();
    app.exit(1);
  });
