import { expect, test, spyOn } from "bun:test";
import { DocumentEngine } from "../src/document-engine";
import { DocumentEngineError } from "../src/exception/document-engine-error";
import { TypedEmitter } from "../src/event/typed-emitter";
import { abortable } from "../src/utils/abortable";
import { numberDocument } from "../src/document-engine/numbering";
import { resolveDocumentReferences } from "../src/document-engine/references";
import { DocumentEngineRun } from "../src/document-engine/run";
import { renderSection } from "../src/document-engine/render-section";
import {
  mergeSectionOptions,
  sectionGroup,
} from "../src/utils/section-options";
import { loadSource } from "./helpers/load-source";
import type {
  DocumentSection,
  EngineRenderers,
  RenderedSection,
} from "../src/types/document-engine";

function surface() {
  const children: HTMLElement[] = [];
  return {
    children,
    childNodes: children,
    append(element: HTMLElement) {
      children.push(element);
    },
    remove(element: HTMLElement) {
      const index = children.indexOf(element);
      if (index >= 0) children.splice(index, 1);
    },
  };
}
const section = (id: string, kind: "template" | "editor"): DocumentSection =>
  kind === "template"
    ? { id, kind, title: id, numbering: "none", html: "<h1>Template</h1>" }
    : {
        id,
        kind,
        title: id,
        numbering: "arabic",
        chapter: id,
        className: "ch",
        nodes: [],
      };
function fixture() {
  const target = surface();
  const rendered: string[] = [],
    destroyed: string[] = [];
  const create = async (
    definition: DocumentSection,
  ): Promise<RenderedSection> => {
    rendered.push(definition.id);
    const element = {
      dataset: {},
      remove() {
        target.remove(this as unknown as HTMLElement);
      },
    } as unknown as HTMLElement;
    const content = {
      querySelector: () => null,
      querySelectorAll: () => [],
    } as unknown as HTMLElement;
    return {
      pages: [{ element, content }],
      outline: [],
      identity: { id: definition.id },
      destroy() {
        destroyed.push(definition.id);
        element.remove();
      },
    };
  };
  const renderers: EngineRenderers = {
    editor: { render: create },
    template: { render: create },
  };
  return {
    target: target as unknown as HTMLElement,
    renderers,
    rendered,
    destroyed,
  };
}

test("engine routes each kind only to its renderer and publishes deterministic lifecycle metadata", async () => {
  const f = fixture(),
    engine = new DocumentEngine(f.renderers),
    trace: string[] = [];
  engine.events.on("start", () => {
    trace.push("start");
  });
  engine.events.on("section.before", (event) => {
    trace.push("before:" + event.section.kind);
  });
  engine.events.on("section.after", (event) => {
    trace.push("after:" + event.sectionId);
  });
  engine.events.on("chapter", ({ chapterId }) => {
    trace.push("chapter:" + chapterId);
  });
  engine.events.on("contentRendered", () => {
    trace.push("content");
  });
  engine.events.on("rendered", (event) => {
    trace.push("rendered:" + event.pages);
  });
  await engine.render(
    f.target,
    [section("cover", "template"), section("1", "editor")],
    "doc",
    new AbortController().signal,
  );
  expect(trace).toEqual([
    "start",
    "before:template",
    "after:cover",
    "before:editor",
    "after:1",
    "chapter:1",
    "content",
    "rendered:2",
  ]);
  expect(engine.sections.map((item) => item.labels)).toEqual([[""], ["1"]]);
  const metadata = engine.sections;
  metadata[0].labels[0] = "changed";
  expect(engine.sections[0].labels).toEqual([""]);
  expect(f.target.children.length).toBe(2);
  engine.destroy();
  engine.destroy();
  expect(f.target.children.length).toBe(0);
  expect(f.destroyed).toEqual(["cover", "1"]);
});

test("failed section hook cleans prior pages and preserves its run/section/stage and original cause", async () => {
  const f = fixture(),
    engine = new DocumentEngine(f.renderers),
    cause = Error("Template hook failure");
  let reported: Error | undefined;
  engine.events.on("section.after", (event) => {
    if (event.sectionId === "2") throw cause;
  });
  engine.events.on("error", (event) => {
    reported = event.error;
  });
  let error: unknown;
  try {
    await engine.render(
      f.target,
      [section("1", "editor"), section("2", "template")],
      "doc",
      new AbortController().signal,
    );
  } catch (caught) {
    error = caught;
  }
  expect(error).toBeInstanceOf(DocumentEngineError);
  const diagnostic = error as DocumentEngineError;
  expect(diagnostic.cause).toBe(cause);
  expect(diagnostic.level).toBe("fatal");
  expect(diagnostic.code).toBe("unexpected");
  expect(diagnostic.diagnostic.sectionId).toBe("2");
  expect(diagnostic.diagnostic.sectionKind).toBe("template");
  expect(diagnostic.diagnostic.stage).toBe("section");
  expect(diagnostic.diagnostic.runId).toBeTruthy();
  expect(reported).toBe(diagnostic);
  expect(f.destroyed.sort()).toEqual(["1", "2"]);
  expect(f.target.children.length).toBe(0);
  engine.destroy();
});

test("deleted reference targets emit structured warnings and retain successful document output", async () => {
  const f = fixture(),
    original = f.renderers.editor.render;
  const attributes = new Map([
    ["href", "#deleted-target"],
    ["data-type", "ref-component"],
  ]);
  const link = {
    textContent: "stale label",
    getAttribute: (key: string) => attributes.get(key),
    setAttribute: (key: string, value: string) => attributes.set(key, value),
    removeAttribute: (key: string) => attributes.delete(key),
  };
  const repeatedAttributes = new Map(attributes);
  const repeatedLink = {
    getAttribute: (key: string) => repeatedAttributes.get(key),
    setAttribute: (key: string, value: string) =>
      repeatedAttributes.set(key, value),
    removeAttribute: (key: string) => repeatedAttributes.delete(key),
  };
  f.renderers.editor.render = async (definition, context) => {
    const result = await original(definition, context);
    result.pages[0].content.querySelectorAll = ((selector: string) =>
      selector === 'a[href]'
        ? [link, repeatedLink]
        : []) as unknown as HTMLElement["querySelectorAll"];
    return result;
  };
  const engine = new DocumentEngine(f.renderers),
    warnings: DocumentEngineError[] = [];
  engine.events.on("diagnostic", ({ error }) => {
    warnings.push(error);
  });
  await engine.render(
    f.target,
    [section("1", "editor")],
    "doc",
    new AbortController().signal,
  );
  expect(engine.state).toBe("ready");
  expect(f.target.children.length).toBe(1);
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toBeInstanceOf(DocumentEngineError);
  expect(warnings[0]).toMatchObject({
    level: "warning",
    code: "reference.missing",
    target: "deleted-target",
    diagnostic: { documentId: "doc", sectionId: "1", stage: "references" },
  });
  expect(attributes.get("href")).toBe("#");
  expect(link.textContent).toBe("Gambar ?");
  expect(attributes.get("data-status")).toBe("missing");
  engine.destroy();
});

test("a source target lost by the renderer warns and retains the rendered content", async () => {
  const f = fixture(), original = f.renderers.editor.render;
  const attributes = new Map([["href", "#existing-target"], ["data-type", "ref-component"], ["data-ref", "figureTable"]]);
  const link = {
    textContent: "Tabel 1.1",
    getAttribute: (key: string) => attributes.get(key),
    setAttribute: (key: string, value: string) => attributes.set(key, value),
    removeAttribute: (key: string) => attributes.delete(key),
  };
  f.renderers.editor.render = async (definition, context) => {
    const result = await original(definition, context);
    result.pages[0].content.querySelectorAll = ((selector: string) =>
      selector === 'a[href]' ? [link] : []) as unknown as HTMLElement["querySelectorAll"];
    return result;
  };
  const definition = section("1", "editor");
  if (definition.kind !== "editor") throw Error("Invalid fixture");
  definition.nodes = [{ type: "paragraph", attrs: { id: "existing-target" } }];
  const engine = new DocumentEngine(f.renderers), warnings: DocumentEngineError[] = [];
  engine.events.on("diagnostic", ({ error }) => { warnings.push(error); });
  await engine.render(f.target, [definition], "doc", new AbortController().signal);
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toMatchObject({ level: "warning", code: "reference.rendering", target: "existing-target" });
  expect(attributes.get("href")).toBe("#");
  expect(link.textContent).toBe("Tabel 1.1");
  expect(engine.state).toBe("ready");
  expect(f.target.children.length).toBe(1);
  expect(f.destroyed).toEqual([]);
  engine.destroy();
});

test("fallback content issues remain warnings and count in the completed run", async () => {
  const f = fixture(), original = f.renderers.editor.render;
  f.renderers.editor.render = async (definition, context) => ({
    ...await original(definition, context),
    issues: [{ kind: "image", key: "missing-image" }, { kind: "citation", key: "missing-cite" }],
  });
  const engine = new DocumentEngine(f.renderers), warnings: DocumentEngineError[] = [];
  engine.events.on("diagnostic", ({ error }) => { warnings.push(error); });
  const result = await engine.render(f.target, [section("1", "editor")], "doc", new AbortController().signal);
  expect(result.warnings).toBe(2);
  expect(warnings.map(error => [error.level, error.code, error.diagnostic.sectionId])).toEqual([
    ["warning", "content.unresolved", "1"], ["warning", "content.unresolved", "1"],
  ]);
  expect(engine.state).toBe("ready");
  engine.destroy();
});

test("abort releases the run while an async hook is stalled and never renders the next section", async () => {
  const f = fixture(),
    engine = new DocumentEngine(f.renderers),
    task = new AbortController();
  let started!: () => void;
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  engine.events.on("section.before", async () => {
    started();
    await new Promise(() => {});
  });
  const pending = engine.render(
    f.target,
    [section("1", "editor")],
    "doc",
    task.signal,
  );
  await entered;
  task.abort();
  await expect(pending).rejects.toHaveProperty("name", "AbortError");
  expect(f.rendered).toEqual([]);
  expect(f.target.children.length).toBe(0);
  engine.destroy();
});

test("dispose during rendering cancels and cleans the current run; instances never share hooks", async () => {
  const f = fixture(),
    engine = new DocumentEngine(f.renderers),
    other = new DocumentEngine(f.renderers);
  other.events.on("start", () => {
    throw Error("Foreign listener");
  });
  engine.events.on("section.after", () => {
    engine.destroy();
  });
  await expect(
    engine.render(
      f.target,
      [section("1", "editor")],
      "doc",
      new AbortController().signal,
    ),
  ).rejects.toHaveProperty("name", "AbortError");
  expect(f.destroyed).toEqual(["1"]);
  expect(f.target.children.length).toBe(0);
  other.destroy();
});

test("an engine rejects reuse and duplicate sections, releasing every produced page", async () => {
  const f = fixture(),
    engine = new DocumentEngine(f.renderers);
  await expect(
    engine.render(
      f.target,
      [section("1", "editor"), section("1", "template")],
      "doc",
      new AbortController().signal,
    ),
  ).rejects.toThrow("Duplicate document section");
  expect(f.destroyed).toEqual([]);
  expect(f.rendered).toEqual([]);
  await expect(
    engine.render(f.target, [], "doc", new AbortController().signal),
  ).rejects.toThrow("unused instance");
  engine.destroy();
});

test("cancel returns promptly and disposes an injected renderer that resolves late", async () => {
  const f = fixture(),
    task = new AbortController();
  let entered!: () => void, complete!: (value: RenderedSection) => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  f.renderers.template.render = () => {
    entered();
    return new Promise<RenderedSection>((resolve) => {
      complete = resolve;
    });
  };
  const engine = new DocumentEngine(f.renderers);
  const pending = engine.render(
    f.target,
    [section("late", "template")],
    "doc",
    task.signal,
  );
  await started;
  task.abort();
  await expect(pending).rejects.toHaveProperty("name", "AbortError");
  let disposed = false;
  complete({
    pages: [],
    outline: [],
    identity: null,
    destroy() {
      disposed = true;
    },
  });
  await Promise.resolve();
  await Promise.resolve();
  expect(disposed).toBe(true);
  engine.destroy();
});

test("failed or stalled outcome observers cannot change success or block other observers", async () => {
  const f = fixture(),
    engine = new DocumentEngine(f.renderers);
  const log = spyOn(console, "error").mockImplementation(() => {});
  const observed: string[] = [];
  engine.events.on("rendered", () => {
    throw Error("Output hook rejected");
  });
  engine.events.on("rendered", () => new Promise(() => {}));
  engine.events.on("rendered", () => {
    observed.push("rendered");
  });
  engine.events.on("error", () => {
    observed.push("error");
  });
  try {
    const result = await engine.render(
      f.target,
      [section("1", "editor")],
      "doc",
      new AbortController().signal,
    );
    expect(result.pages).toBe(1);
    expect(f.target.children.length).toBe(1);
    expect(engine.state).toBe("ready");
    expect(observed).toEqual(["rendered"]);
    expect(log).toHaveBeenCalledTimes(1);
  } finally {
    log.mockRestore();
    engine.destroy();
  }
});

test("source changes during hooks cannot change the captured run", async () => {
  const f = fixture(),
    engine = new DocumentEngine(f.renderers);
  const input = [section("1", "editor")];
  engine.events.on("start", () => {
    input[0].id = "changed";
  });
  engine.events.on("section.before", ({ section }) => {
    if (section.kind === "editor")
      section.nodes.push({ type: "text", text: "Hook-local mutation" });
  });
  await engine.render(f.target, input, "doc", new AbortController().signal);
  expect(f.rendered).toEqual(["1"]);
  expect(engine.state).toBe("ready");
  engine.destroy();
  expect(engine.state).toBe("disposed");
});

test("content finishes once before index passes, while final page order and offsets stay canonical", async () => {
  // Isolate index HTML generation; exercise the real run, numbering and lifecycle.
  const { DocumentEngine: Engine } = loadSource<
    typeof import("../src/document-engine")
  >(new URL("../src/document-engine/index.ts", import.meta.url), {
    "@/event/typed-emitter": { TypedEmitter },
    "@/utils/abortable": { abortable },
    "@/exception/document-engine-error": { DocumentEngineError },
    "./numbering": { numberDocument },
    "./references": { resolveDocumentReferences },
    "@/utils/section-options": { mergeSectionOptions, sectionGroup },
    "./run": { DocumentEngineRun },
    "./render-section": { renderSection },
    "./indexes/document-index": {
      DocumentIndex: class {
        collect() {}
        html(_section: unknown, targets: ReadonlyMap<string, string>) {
          return `Chapter page: ${targets.get("body-anchor")}`;
        }
      },
    },
  });
  const f = fixture(),
    base = f.renderers.editor.render,
    template = f.renderers.template.render;
  f.renderers.editor.render = async (definition, context) => {
    const result = await base(definition, context);
    result.pages[0].content.querySelectorAll = ((selector: string) =>
      selector === "[id]"
        ? [{ id: "body-anchor" }]
        : []) as unknown as HTMLElement["querySelectorAll"];
    return result;
  };
  f.renderers.template.render = async (definition, context) => {
    const result = await template(definition, context);
    const second = {
      dataset: {},
      remove() {
        const children = f.target.children as unknown as HTMLElement[];
        const index = children.indexOf(this as unknown as HTMLElement);
        if (index >= 0) children.splice(index, 1);
      },
    } as unknown as HTMLElement;
    return {
      ...result,
      pages: [
        ...result.pages,
        { element: second, content: result.pages[0].content },
      ],
      destroy() {
        result.destroy();
        second.remove();
      },
    };
  };
  const decorated: string[] = [],
    engine = new Engine(f.renderers, {}, (page, { label }) => {
      decorated.push(label);
      page.element.dataset.numberPainted = label;
    });
  const trace: { type: string; sequence: number }[] = [],
    passes: { pass: number; changed: readonly string[]; stable: boolean }[] =
      [];
  for (const type of [
    "start",
    "section.before",
    "section.after",
    "chapter",
    "contentRendered",
    "index.pass",
    "rendered",
    "dispose",
  ] as const)
    engine.events.on(type, (event) => {
      trace.push({ type, sequence: event.sequence });
    });
  engine.events.on("contentRendered", (event) => {
    expect(f.rendered).toEqual(["body"]);
    expect(event.contentPages).toBe(1);
    expect(event.sections).toBe(1);
  });
  engine.events.on("index.pass", ({ pass, changed, stable }) => {
    passes.push({ pass, changed, stable });
  });
  let atCompletion: { labels: string[]; order: string[] } | undefined;
  engine.events.on("rendered", ({ sections }) => {
    atCompletion = {
      labels: [...decorated],
      order: sections.map((section) => section.id),
    };
  });
  const body = {
    ...section("body", "editor"),
    numbering: "roman",
  } as DocumentSection;
  const result = await engine.render(
    f.target,
    [
      {
        id: "toc",
        kind: "template",
        title: "DAFTAR ISI",
        numbering: "roman",
        index: "toc",
        html: "Unrendered",
      },
      body,
    ],
    "doc",
    new AbortController().signal,
  );
  expect(f.rendered).toEqual(["body", "toc", "toc"]);
  expect(passes).toEqual([
    { pass: 1, changed: ["toc"], stable: false },
    { pass: 2, changed: ["toc"], stable: false },
    { pass: 3, changed: [], stable: true },
  ]);
  expect(trace.filter(({ type }) => type === "chapter")).toHaveLength(1);
  expect(trace.filter(({ type }) => type === "contentRendered")).toHaveLength(
    1,
  );
  expect(result.sections[1]).toMatchObject({ firstPage: 3, labels: ["iii"] });
  expect(atCompletion).toEqual({
    labels: ["i", "ii", "iii"],
    order: ["toc", "body"],
  });
  expect(
    Array.from(
      f.target.children,
      (page) => (page as HTMLElement).dataset.documentSection,
    ),
  ).toEqual(["toc", "toc", "body"]);
  engine.destroy();
  expect(f.target.children.length).toBe(0);
  expect(trace.map(({ sequence }) => sequence)).toEqual(
    trace.map((_, index) => index + 1),
  );
});

test("dispose while a phase hook is running emits cancel before dispose, exactly once", async () => {
  const f = fixture(),
    engine = new DocumentEngine(f.renderers),
    trace: string[] = [];
  engine.events.on("contentRendered", () => {
    engine.destroy();
  });
  for (const type of ["rendered", "error", "cancel", "dispose"] as const)
    engine.events.on(type, () => {
      trace.push(type);
    });
  await expect(
    engine.render(
      f.target,
      [section("1", "editor")],
      "doc",
      new AbortController().signal,
    ),
  ).rejects.toHaveProperty("name", "AbortError");
  engine.destroy();
  expect(trace).toEqual(["cancel", "dispose"]);
  expect(engine.state).toBe("disposed");
  expect(f.target.children.length).toBe(0);
});

test("success observers see completed decoration and disposal waits for the outcome dispatch", async () => {
  const f = fixture(),
    trace: string[] = [];
  const engine = new DocumentEngine(f.renderers, {}, (page) => {
    page.element.dataset.painted = "yes";
  });
  let completion: unknown;
  engine.events.on("rendered", ({ sections }) => {
    completion = {
      painted: (f.target.children[0] as HTMLElement).dataset.painted,
      frozen: Object.isFrozen(sections) && Object.isFrozen(sections[0].labels),
    };
    trace.push("rendered:first");
    engine.destroy();
  });
  engine.events.on("rendered", () => {
    trace.push("rendered:second");
  });
  engine.events.on("dispose", () => {
    trace.push("dispose");
  });
  await engine.render(
    f.target,
    [section("1", "editor")],
    "doc",
    new AbortController().signal,
  );
  expect(trace).toEqual(["rendered:first", "rendered:second", "dispose"]);
  expect(completion).toEqual({ painted: "yes", frozen: true });
  expect(engine.state).toBe("disposed");
});

test("failed phase hooks retain their original failure even when error observers fail or stall", async () => {
  const f = fixture(),
    engine = new DocumentEngine(f.renderers);
  const log = spyOn(console, "error").mockImplementation(() => {});
  const cause = Error("Phase failure");
  engine.events.on("contentRendered", () => {
    throw cause;
  });
  engine.events.on("error", () => {
    throw Error("Reporting failure");
  });
  engine.events.on("error", () => new Promise(() => {}));
  const trace: string[] = [];
  engine.events.on("error", () => {
    trace.push("error");
  });
  engine.events.on("cancel", () => {
    trace.push("cancel");
  });
  engine.events.on("rendered", () => {
    trace.push("rendered");
  });
  engine.events.on("dispose", () => {
    trace.push("dispose");
  });
  try {
    await expect(
      engine.render(
        f.target,
        [section("1", "editor")],
        "doc",
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ cause });
    engine.destroy();
    expect(trace).toEqual(["error", "dispose"]);
    expect(f.target.children.length).toBe(0);
    expect(log).toHaveBeenCalledTimes(1);
  } finally {
    log.mockRestore();
    engine.destroy();
  }
});

test("per-group section options are frozen inputs, merge with definitions and reach hooks/renderers", async () => {
  const f = fixture();
  const options = {
    sections: {
      content: {
        margins: { top: 20 },
        pageNumber: { position: "top-center" as const },
      },
    },
  };
  const engine = new DocumentEngine(f.renderers, options);
  options.sections.content.margins.top = 99;
  const definition = {
    ...section("body", "editor"),
    options: {
      margins: { left: 40 },
      pageNumber: { position: "bottom-left" as const },
    },
  };
  const seen: DocumentSection["options"][] = [];
  engine.events.on("section.before", ({ section }) => {
    seen.push(section.options);
  });
  await engine.render(
    f.target,
    [definition],
    "doc",
    new AbortController().signal,
  );
  expect(seen).toEqual([
    { margins: { left: 40, top: 20 }, pageNumber: { position: "top-center" } },
  ]);
  expect(engine.identity[0].options).toEqual(seen[0]);
  expect(definition.options).toEqual({
    margins: { left: 40 },
    pageNumber: { position: "bottom-left" },
  });
  engine.destroy();
});

test("section groups configure every part in that group and number formats keep independent sequences", async () => {
  const f = fixture();
  const engine = new DocumentEngine(f.renderers, {
    sections: {
      introduction: {
        margins: { left: 35 },
        pageNumber: { format: "roman-upper" },
      },
      content: { margins: { top: 20 }, pageNumber: { format: "alpha-lower" } },
    },
  });
  const parts = [
    section("cover", "template"),
    { ...section("foreword", "editor"), numbering: "roman" as const },
    { ...section("toc-body", "editor"), numbering: "roman" as const },
    section("1", "editor"),
    section("2", "editor"),
  ];
  const groups: unknown[] = [];
  engine.events.on("section.before", ({ section }) => {
    groups.push({
      id: section.id,
      group: section.group,
      options: section.options,
    });
  });
  await engine.render(f.target, parts, "doc", new AbortController().signal);
  expect(engine.sections.map((part) => part.labels)).toEqual([
    [""],
    ["II"],
    ["III"],
    ["a"],
    ["b"],
  ]);
  expect(groups.map((value) => (value as { group: string }).group)).toEqual([
    "introduction",
    "introduction",
    "introduction",
    "content",
    "content",
  ]);
  expect(groups[1]).toEqual({
    id: "foreword",
    group: "introduction",
    options: { margins: { left: 35 }, pageNumber: { format: "roman-upper" } },
  });
  engine.destroy();
});
