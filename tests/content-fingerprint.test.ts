import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { zipSync, strToU8 } from "fflate";
import { parseHighTexV2, HighTexImportError } from "@hightex/importer";
import { contentFingerprint } from "../src/utils/htx/content-fingerprint";

const entries = {
  "manifest.json": strToU8(
    JSON.stringify({
      version: 2,
      format: "json",
      document: { id: "original" },
    }),
  ),
  "files/chapters/chapter1.json": strToU8(
    '[{"type":"paragraph","content":[{"type":"text","text":"Hello"}]}]',
  ),
  "files/assets/references.json": strToU8('{"ref":"@article{ref}"}'),
  "files/assets/images/figure.webp": new Uint8Array([0, 1, 2, 255]),
};
const archive = (extra: Record<string, Uint8Array> = {}, reverse = false) =>
  zipSync(
    Object.fromEntries(
      reverse
        ? Object.entries({ ...entries, ...extra }).reverse()
        : Object.entries({ ...entries, ...extra }),
    ),
    { level: reverse ? 0 : 9, mtime: new Date(reverse ? 2025 : 1980, 0, 1) },
  );

test("repackaging and mutable profile/photo/export context do not change imported content", async () => {
  const first = archive({
    "files/profile.json": strToU8('{"name":"A"}'),
    "files/assets/profile.webp": strToU8("photo-a"),
    "files/config.json": strToU8('{"advisors":["A"]}'),
    "meta/export.json": strToU8('{"timestamp":1}'),
  });
  const second = archive(
    {
      "files/profile.json": strToU8('{"name":"B"}'),
      "files/assets/profile.webp": strToU8("photo-b"),
      "manifest.json": strToU8(
        '{"schema_version":2,"format":"json","document":{"id":"original"},"profile":{"name":"B"}}',
      ),
      "files/config.json": strToU8('{"advisors":["A"]}'),
      "meta/export.json": strToU8('{"timestamp":2}'),
    },
    true,
  );
  expect(createHash("sha256").update(first).digest("hex")).not.toBe(
    createHash("sha256").update(second).digest("hex"),
  );
  expect(await contentFingerprint(first)).toBe(
    await contentFingerprint(second),
  );
});
test("document config participates in the content fingerprint", async () => {
  const original = await contentFingerprint(archive());
  expect(
    await contentFingerprint(
      archive({
        "files/config.json": strToU8('{"consentDate":"2026-10-28"}'),
      }),
    ),
  ).not.toBe(original);
});
test("local/server document IDs and other manifest fields do not change the fingerprint", async () => {
  const original = await contentFingerprint(archive());
  for (const extra of [
    {
      "manifest.json": strToU8(
        '{"version":2,"document":{"id":"different-server-id"}}',
      ),
    },
    {
      "manifest.json": strToU8(
        '{"version":2,"document":{"id":"original","title":{"id":"Changed title"}}}',
      ),
    },
    {
      "manifest.json": strToU8(
        '{"version":2,"document":{"id":"original","keywords":{"id":["changed"]}}}',
      ),
    },
    {
      "manifest.json": strToU8(
        '{"version":2,"document":{"id":"original","category":"2"}}',
      ),
    },
  ] as Record<string, Uint8Array>[]) {
    expect(await contentFingerprint(archive(extra))).toBe(original);
  }
});
test("chapter and reference edits change the fingerprint", async () => {
  const original = await contentFingerprint(archive());
  for (const [path, bytes] of Object.entries({
    "files/chapters/chapter1.json": strToU8(
      '[{"type":"paragraph","content":[{"type":"text","text":"Edited"}]}]',
    ),
    "files/assets/references.json": strToU8('{"ref":"@article{edited}"}'),
  }))
    expect(await contentFingerprint(archive({ [path]: bytes }))).not.toBe(
      original,
    );
});
test("uses the importer model and ignores JSON formatting/key order", async () => {
  const file = archive();
  expect(await contentFingerprint(file)).toBe(
    await contentFingerprint(parseHighTexV2(file)),
  );
  const repack = archive(
    {
      "files/chapters/chapter1.json": strToU8(
        '[ {"content":[{"text":"Hello","type":"text"}], "type":"paragraph"} ]',
      ),
    },
    true,
  );
  expect(await contentFingerprint(repack)).toBe(await contentFingerprint(file));
});
test("invalid packages use the importer validation instead of a second ZIP parser", async () => {
  await expect(
    contentFingerprint(zipSync({ "files/profile.json": strToU8("{}") })),
  ).rejects.toBeInstanceOf(HighTexImportError);
});

test("document illustration edits change the hash while profile photos stay excluded", async () => {
  const first = archive();
  const second = archive({
    "files/assets/images/figure.webp": new Uint8Array([5, 6, 7]),
  });
  expect(await contentFingerprint(first)).not.toBe(
    await contentFingerprint(second),
  );
});

test("cloud hash uses the reference JSON-entry framing: path, NUL, JSON, NUL", async () => {
  const jsonEntries = [
    ["files/assets/aliases.json", "[]"],
    [
      "files/assets/images.json",
      JSON.stringify({
        figure: createHash("sha256")
          .update(new Uint8Array([0, 1, 2, 255]))
          .digest("hex"),
      }),
    ],
    ["files/assets/references.json", '{"ref":"@article{ref}"}'],
    ["files/assets/variables.json", "[]"],
    [
      "files/chapters/chapter1.json",
      '[{"content":[{"text":"Hello","type":"text"}],"type":"paragraph"}]',
    ],
    ["files/config.json", "{}"],
  ];
  const hash = createHash("sha256");
  for (const [name, content] of jsonEntries) {
    hash.update(name);
    hash.update(new Uint8Array([0]));
    hash.update(content);
    hash.update(new Uint8Array([0]));
  }
  expect(await contentFingerprint(archive())).toBe(hash.digest("hex"));
});
