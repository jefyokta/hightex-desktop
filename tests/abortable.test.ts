import { expect, test } from "bun:test";
import { abortable } from "../src/utils/abortable";

test("canceling an unresolved render resource stops waiting and tolerates its late failure", async () => {
  const task = new AbortController();
  let fail!: (error: unknown) => void;
  const resource = new Promise<never>((_resolve, reject) => {
    fail = reject;
  });
  const waiting = abortable(resource, task.signal);
  task.abort(new Error("Capture closed"));
  await expect(waiting).rejects.toThrow("Capture closed");
  fail(new Error("Image decoded after close"));
  await Promise.resolve();
  await expect(abortable(Promise.resolve("ready"))).resolves.toBe("ready");
  await expect(
    abortable(Promise.resolve("ready"), task.signal),
  ).rejects.toThrow("Capture closed");
});
