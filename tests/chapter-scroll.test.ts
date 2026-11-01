import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function fixture() {
  const document = new EventTarget();
  const content = new EventTarget();
  const frames = new Map<number, () => void>();
  const timers = new Map<number, () => void>();
  const observers = new Set<() => void>();
  let sequence = 0;
  class ScrollContainer extends EventTarget {
    scrollTop = 0;
    scrollLeft = 0;
    maxTop = 5000;
    scrollTo({ top = 0, left = 0 }: ScrollToOptions) {
      this.scrollTop = Math.min(top, this.maxTop);
      this.scrollLeft = left;
      this.dispatchEvent(new Event("scroll"));
    }
  }
  const container = new ScrollContainer();
  const sandbox = {
    exports: {} as typeof import("../src/editor/chapter/scroll-position"),
    document,
    requestAnimationFrame: (callback: () => void) => {
      frames.set(++sequence, callback);
      return sequence;
    },
    cancelAnimationFrame: (id: number) => frames.delete(id),
    setTimeout: (callback: () => void) => {
      timers.set(++sequence, callback);
      return sequence;
    },
    clearTimeout: (id: number) => timers.delete(id),
    ResizeObserver: class {
      constructor(private callback: () => void) {}
      observe() {
        observers.add(this.callback);
      }
      disconnect() {
        observers.delete(this.callback);
      }
    },
  };
  vm.runInNewContext(
    ts.transpileModule(
      readFileSync(
        new URL("../src/editor/chapter/scroll-position.ts", import.meta.url),
        "utf8",
      ),
      { compilerOptions: { module: ts.ModuleKind.CommonJS } },
    ).outputText,
    sandbox,
  );
  return {
    container,
    visit: (id: string, restore = true) =>
      sandbox.exports.trackChapterScroll(
        id,
        container as unknown as HTMLElement,
        content as unknown as HTMLElement,
        restore,
      ),
    frame: () => {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback());
    },
    settle: () => [...timers.values()].forEach((callback) => callback()),
    intent: () => document.dispatchEvent(new Event("pointerdown")),
    resize: () => [...observers].forEach((callback) => callback()),
  };
}

test("each chapter remembers its own vertical and horizontal reading position", () => {
  const f = fixture();
  let leave = f.visit("doc.1");
  f.frame();
  f.intent();
  f.container.scrollTo({ top: 950, left: 70 });
  leave();

  leave = f.visit("doc.4");
  f.frame();
  expect(f.container.scrollTop).toBe(0);
  f.intent();
  f.container.scrollTo({ top: 350, left: 10 });
  leave();

  leave = f.visit("doc.1");
  f.frame();
  expect(f.container.scrollTop).toBe(950);
  expect(f.container.scrollLeft).toBe(70);
  leave();

  f.visit("doc.4");
  f.frame();
  expect(f.container.scrollTop).toBe(350);
  expect(f.container.scrollLeft).toBe(10);
});

test("document IDs and versions have separate positions", () => {
  const f = fixture();
  const leave = f.visit("doc.1");
  f.frame();
  f.intent();
  f.container.scrollTo({ top: 1200 });
  leave();

  for (const id of ["other.1", "doc.1.v1", "doc.cv"]) {
    const cleanup = f.visit(id);
    f.frame();
    expect(f.container.scrollTop).toBe(0);
    cleanup();
  }
  f.visit("doc.1");
  f.frame();
  expect(f.container.scrollTop).toBe(1200);
});

test("a shrinking outgoing page and delayed scroll events cannot overwrite its position", () => {
  const f = fixture();
  const leave = f.visit("doc.1");
  f.frame();
  f.settle();
  f.container.scrollTo({ top: 1100 });
  f.container.scrollTop = 0;
  leave();
  f.container.dispatchEvent(new Event("scroll"));

  f.visit("doc.1");
  f.frame();
  expect(f.container.scrollTop).toBe(1100);
});

test("restoration retries when late content makes the saved offset reachable", () => {
  const f = fixture();
  let leave = f.visit("doc.1");
  f.frame();
  f.intent();
  f.container.scrollTo({ top: 1800 });
  leave();

  f.container.maxTop = 200;
  leave = f.visit("doc.1");
  f.frame();
  expect(f.container.scrollTop).toBe(200);
  f.container.maxTop = 5000;
  f.resize();
  f.frame();
  expect(f.container.scrollTop).toBe(1800);
  f.settle();
  leave();
  f.visit("doc.1");
  f.frame();
  expect(f.container.scrollTop).toBe(1800);
});

test("user interaction cancels restoration so late layout changes do not pull them back", () => {
  const f = fixture();
  const leave = f.visit("doc.1");
  f.frame();
  f.intent();
  f.container.scrollTo({ top: 900 });
  f.resize();
  f.frame();
  f.settle();
  expect(f.container.scrollTop).toBe(900);
  leave();
  f.visit("doc.1");
  f.frame();
  expect(f.container.scrollTop).toBe(900);
});

test("explicit reference navigation overrides the saved offset and becomes the new position", () => {
  const f = fixture();
  let leave = f.visit("doc.1");
  f.frame();
  f.intent();
  f.container.scrollTo({ top: 900 });
  leave();

  leave = f.visit("doc.1", false);
  f.container.scrollTo({ top: 2300 });
  f.resize();
  f.frame();
  expect(f.container.scrollTop).toBe(2300);
  leave();

  f.visit("doc.1");
  f.frame();
  expect(f.container.scrollTop).toBe(2300);
});

test("rapid chapter navigation cancels the previous chapter's pending restoration", () => {
  const f = fixture();
  let leave = f.visit("doc.1");
  f.frame();
  f.intent();
  f.container.scrollTo({ top: 1400 });
  leave();

  leave = f.visit("doc.1");
  leave();
  f.visit("doc.4");
  f.frame();
  f.resize();
  f.frame();
  expect(f.container.scrollTop).toBe(0);
});
