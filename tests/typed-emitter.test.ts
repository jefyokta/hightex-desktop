import { expect, test } from "bun:test";
import { TypedEmitter } from "../src/event/typed-emitter";

test("hooks are instance-local, ordered and await async completion", async () => {
  const first = new TypedEmitter<{ done: number }>(),
    second = new TypedEmitter<{ done: number }>();
  const seen: string[] = [];
  first.on("done", async (value) => {
    await Promise.resolve();
    seen.push("first:" + value);
  });
  first.on("done", (value) => {
    seen.push("second:" + value);
  });
  second.on("done", () => {
    throw Error("Foreign run");
  });
  await first.emit("done", 3);
  expect(seen).toEqual(["first:3", "second:3"]);
});

test("once detaches before reentrant emission and unsubscribe is idempotent", async () => {
  const events = new TypedEmitter<{ tick: number }>();
  let calls = 0;
  events.once("tick", async (value) => {
    calls++;
    await events.emit("tick", value + 1);
  });
  const off = events.on("tick", () => {
    calls += 10;
  });
  off();
  off();
  await events.emit("tick", 1);
  await events.emit("tick", 2);
  expect(calls).toBe(1);
  events.on("tick", () => {
    calls++;
  });
  events.clear();
  await events.emit("tick", 3);
  expect(calls).toBe(1);
});

test("an awaited failing hook stops the job without running later hooks", async () => {
  const events = new TypedEmitter<{ step: string }>();
  let later = false;
  events.on("step", async () => {
    throw Error("Hook rejected");
  });
  events.on("step", () => {
    later = true;
  });
  await expect(events.emit("step", "render")).rejects.toThrow("Hook rejected");
  expect(later).toBe(false);
});

test("notifications report sync and async failures without awaiting or skipping observers", async () => {
  const events = new TypedEmitter<{ done: number }>();
  const called: number[] = [],
    errors: unknown[] = [];
  events.on("done", () => {
    called.push(1);
    throw Error("Sync observer");
  });
  events.on("done", async () => {
    called.push(2);
    throw Error("Async observer");
  });
  events.on("done", () => new Promise(() => {}));
  events.once("done", () => {
    called.push(3);
  });
  events.notify("done", 1, (error) => {
    errors.push(error);
  });
  await Promise.resolve();
  await Promise.resolve();
  expect(called).toEqual([1, 2, 3]);
  expect(errors.map((error) => (error as Error).message)).toEqual([
    "Sync observer",
    "Async observer",
  ]);
  events.clear();
});
