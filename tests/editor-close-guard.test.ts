import { expect, test } from "bun:test";
import { zipSync, strToU8 } from "fflate";
import { archiveFingerprint } from "../electron/utilities/archive-fingerprint";
import { EditorCloseGuard } from "../electron/utilities/editor-close-guard";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
function fixture(
  options: {
    dirty?: boolean;
    choice?: "save" | "discard" | "cancel";
    saved?: boolean;
    error?: boolean;
  } = {},
) {
  const events: string[] = [];
  const guard = new EditorCloseGuard({
    dirty: async () => {
      events.push("inspect");
      if (options.error) throw Error("Storage failed");
      return options.dirty ?? true;
    },
    confirm: async () => {
      events.push("confirm");
      return options.choice ?? "save";
    },
    save: async () => {
      events.push("save");
      return options.saved ?? true;
    },
    close: () => {
      events.push("close");
      guard.request({ preventDefault: () => events.push("prevent-again") });
    },
    lock: (locked) => {
      events.push(locked ? "lock" : "unlock");
    },
    error: async () => {
      events.push("error");
    },
  });
  return {
    guard,
    events,
    request: () =>
      guard.request({ preventDefault: () => events.push("prevent") }),
  };
}

test("clean editors close without a prompt; changed editors save before closing", async () => {
  const clean = fixture({ dirty: false });
  clean.request();
  await tick();
  expect(clean.events).toEqual([
    "prevent",
    "lock",
    "inspect",
    "close",
    "unlock",
  ]);
  const dirty = fixture();
  dirty.request();
  await tick();
  expect(dirty.events).toEqual([
    "prevent",
    "lock",
    "inspect",
    "confirm",
    "save",
    "close",
    "unlock",
  ]);
});
test("canceling the confirmation or file chooser leaves the editor open and permits retry", async () => {
  for (const options of [{ choice: "cancel" as const }, { saved: false }]) {
    const f = fixture(options);
    f.request();
    await tick();
    expect(f.events).not.toContain("close");
    expect(f.events[f.events.length - 1]).toBe("unlock");
    f.request();
    await tick();
    expect(f.events.filter((e) => e === "confirm")).toHaveLength(2);
  }
});
test("closing without saving archives does not invoke the archive writer", async () => {
  const f = fixture({ choice: "discard" });
  f.request();
  await tick();
  expect(f.events).toContain("close");
  expect(f.events).not.toContain("save");
});
test("storage failures keep the editor open, and repeated close events share one prompt", async () => {
  const failed = fixture({ error: true });
  failed.request();
  await tick();
  expect(failed.events).toContain("error");
  expect(failed.events).not.toContain("close");
  const f = fixture();
  f.request();
  f.request();
  f.request();
  await tick();
  expect(f.events.filter((e) => e === "confirm")).toHaveLength(1);
  expect(f.events.filter((e) => e === "close")).toHaveLength(1);
});
const archive = (
  entries: Record<string, unknown>,
  mtime = new Date(2026, 0, 1),
) =>
  zipSync(
    Object.fromEntries(
      Object.entries(entries).map(([name, value]) => [
        name,
        strToU8(JSON.stringify(value)),
      ]),
    ),
    { mtime },
  );
const contents = {
  "manifest.json": {
    document: { title: { id: "Original", en: "" }, category: "1" },
  },
  "files/config.json": { consentDate: "2026-01-01" },
  "files/profile.json": {
    name: "Writer",
    advisorName: "Advisor",
    committee: { chair: { name: "Chair", nip: "00001" } },
  },
  "files/chapters/1.json": [
    { type: "paragraph", content: [{ type: "text", text: "Initial text" }] },
  ],
  "files/assets/references.json": { example: "@book{example,title={A}}" },
  "files/assets/images/image.json": [1, 2, 3],
  "files/assets/variables.json": [{ name: "sample", value: "one" }],
};
test("dirty detection covers title, profile, committee, chapters, config, references and assets", () => {
  const original = archiveFingerprint(archive(contents));
  for (const name of Object.keys(contents)) {
    const edited = { ...contents, [name]: { modified: true } };
    expect(archiveFingerprint(archive(edited))).not.toBe(original);
  }
});
test("ZIP dates, entry ordering and JSON object key ordering do not create false changes", () => {
  const reversed = Object.fromEntries(Object.entries(contents).reverse());
  reversed["manifest.json"] = {
    document: { category: "1", title: { en: "", id: "Original" } },
  };
  expect(archiveFingerprint(archive(reversed, new Date(2025, 0, 1)))).toBe(
    archiveFingerprint(archive(contents)),
  );
  expect(() => archiveFingerprint(new Uint8Array([1, 2]))).toThrow();
});
