import { strict as assert } from "node:assert";
import { readFile, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { zipSync, unzipSync, strToU8 } from "fflate";
import { CloudSyncClient } from "../../electron/service/cloud-sync-client";
import { contentFingerprint } from "../../src/utils/htx/content-fingerprint";
import { Schema } from "../../src/utils/htx/schema";
import { emptyAuthorProfile } from "../../src/utils/document-profile";
import { writeProfileEntries } from "../../src/utils/htx/profile";
import { ServerUrl } from "../../electron/url/server-url";

// Opt-in HTTP integration. Refuses to replace an occupied cloud slot.
// HIGHTEX_TEST_CREDENTIALS points to a private JSON file; credentials are never logged.
const fixturePath = process.env.HIGHTEX_TEST_CREDENTIALS;
assert.ok(
  fixturePath,
  "Set HIGHTEX_TEST_CREDENTIALS to a dedicated test-account fixture",
);
const fixture = JSON.parse(await readFile(fixturePath, "utf8")) as {
  serverUrl: string;
  email: string;
  password: string;
};
const server = new ServerUrl(fixture.serverUrl);
const base = server.api.href;
const events: { method: string; path: string; status: number }[] = [];
const backups: string[] = [];
const login = await fetch(server.endpoint("/login"), {
  method: "POST",
  headers: { Accept: "application/json", "Content-Type": "application/json" },
  body: JSON.stringify({ email: fixture.email, password: fixture.password }),
});
assert.equal(login.status, 200, "Fixture login failed");
const { data } = (await login.json()) as {
  data: {
    token: string;
    user: { id: number; name: string; identity_number: string };
  };
};
const transport = {
  session: () => ({
    serverUrl: base,
    accountId: String(data.user.id),
    token: data.token,
  }),
  request: async (endpoint: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers);
    headers.set("Authorization", "Bearer " + data.token);
    headers.set("Accept", "application/json");
    const response = await fetch(server.endpoint(endpoint), {
      ...options,
      headers,
    });
    events.push({
      method: options.method ?? "GET",
      path: endpoint,
      status: response.status,
    });
    const binary = /application\/(x-hightex|octet-stream)/.test(
      response.headers.get("Content-Type") ?? "",
    );
    return {
      ok: response.ok,
      status: response.status,
      headers: response.headers,
      data: binary
        ? new Uint8Array(await response.arrayBuffer())
        : response.status === 204
          ? {}
          : ((await response.json()) as unknown),
    };
  },
};

try {
  const categories = await transport.request("/categories");
  assert.equal(categories.status, 200);
  const category = (categories.data as { data: Category[] }).data.find(
    (item) => item.variant === "thesis",
  );
  assert.ok(category, "No thesis fixture category");
  const document: HighTexDocument = {
    id: "cloud-content-http-fixture",
    title: "Cloud Content HTTP Fixture",
    altTitle: "HTTP test",
    category: String(category.id),
    keywords: { indonesian: ["uji"], english: ["test"] },
    config: {},
    profile: {
      ...emptyAuthorProfile(),
      name: data.user.name,
      nim: data.user.identity_number,
    },
  };
  const makeFile = async (text: string, figure = "figure-a") => {
    const schema = new Schema();
    schema.writter.putManifest(schema.createManifest(document));
    schema.writter.putConfig(document.config);
    schema.writter.putChapter("1", [
      { type: "paragraph", content: [{ type: "text", text }] },
      { type: "image", attrs: { src: "figure" } },
    ]);
    schema.writter.putReference([]);
    schema.writter.putVariables([{ name: "project", value: "HTTP fixture" }]);
    schema.writter.putAliases([]);
    await schema.writter.putImage(
      "figure",
      new Blob([figure], { type: "image/webp" }),
    );
    return zipSync(
      {
        ...schema.writter.getEntries(),
        ...(await writeProfileEntries(document.profile!)),
      },
      { mtime: new Date(1980, 0, 1) },
    );
  };
  const makeClient = () => {
    let bindings: Record<string, CloudBinding> = {};
    return new CloudSyncClient({
      ...transport,
      readBindings: () => bindings,
      writeBindings: (value) => {
        bindings = value;
      },
      category: async () => category,
      backup: async (_session, file) => {
        const target = join(dirname(fixturePath), `${randomUUID()}.hightex`);
        await writeFile(target, file, { flag: "wx", mode: 0o600 });
        backups.push(target);
        return target;
      },
    });
  };
  const first = makeClient();
  const second = makeClient();
  const firstSession = first.context().sessionId;
  const secondSession = second.context().sessionId;
  assert.equal(
    (await first.list(firstSession)).commits.length,
    0,
    "Use an empty dedicated test account",
  );
  const push = (
    client: CloudSyncClient,
    file: Uint8Array,
    serverId: string | null,
    version: string | null,
  ) =>
    client.push({
      sessionId: client.context().sessionId,
      file,
      document,
      message: "Cloud content HTTP regression",
      expectedServerDocumentId: serverId,
      expectedCloudSha256: version,
      replace: false,
    });
  const a = await makeFile("Version A");
  const savedA = await push(first, a, null, null);
  assert.equal(savedA.status, "saved");
  if (savedA.status !== "saved") throw new Error("First push failed");
  assert.equal(savedA.changed, true);
  assert.equal(savedA.sha256, await contentFingerprint(a));
  const downloadedA = await second.pull({
    sessionId: secondSession,
    serverDocumentId: savedA.serverDocumentId,
  });
  assert.equal(downloadedA.status, "downloaded");
  if (downloadedA.status !== "downloaded") throw new Error("First pull failed");
  assert.deepEqual(downloadedA.file, a);
  assert.equal(downloadedA.sha256, savedA.sha256);
  second.accept({
    sessionId: secondSession,
    downloadId: downloadedA.downloadId,
    localDocumentId: document.id,
  });

  const mutable = unzipSync(a);
  mutable["files/profile.json"] = strToU8(
    JSON.stringify({
      ...document.profile,
      name: "Changed mutable profile",
      cv: "Changed CV",
    }),
  );
  mutable["files/assets/profile.webp"] = strToU8("changed profile photo");
  mutable["meta/export.json"] = strToU8(
    JSON.stringify({ exported_by: "HTTP test", timestamp: Date.now() }),
  );
  const repacked = zipSync(
    Object.fromEntries(Object.entries(mutable).reverse()),
    { level: 0, mtime: new Date(2025, 0, 1) },
  );
  assert.notDeepEqual(repacked, a);
  assert.equal(await contentFingerprint(repacked), savedA.sha256);
  const unchanged = await push(
    first,
    repacked,
    savedA.serverDocumentId,
    savedA.sha256,
  );
  assert.equal(unchanged.status, "saved");
  if (unchanged.status !== "saved") throw new Error("Mutable-only push failed");
  assert.equal(unchanged.changed, false);
  assert.equal(unchanged.sha256, savedA.sha256);
  assert.equal(
    (await first.list(firstSession)).commits.length,
    1,
    "Mutable-only changes created an archive",
  );

  const imageEdited = await makeFile("Version A", "figure-b");
  const savedImage = await push(
    second,
    imageEdited,
    savedA.serverDocumentId,
    savedA.sha256,
  );
  assert.equal(savedImage.status, "saved");
  if (savedImage.status !== "saved")
    throw new Error("Illustration push failed");
  assert.equal(savedImage.changed, true);
  assert.notEqual(savedImage.sha256, savedA.sha256);
  assert.equal((await second.list(secondSession)).commits.length, 2);
  const b = await makeFile("Version B", "figure-b");
  const savedB = await push(
    second,
    b,
    savedA.serverDocumentId,
    savedImage.sha256,
  );
  assert.equal(savedB.status, "saved");
  if (savedB.status !== "saved") throw new Error("Content push failed");
  assert.equal(savedB.changed, true);
  assert.notEqual(savedB.sha256, savedImage.sha256);
  const conflict = await push(
    first,
    await makeFile("Stale device edit"),
    savedA.serverDocumentId,
    savedB.sha256,
  );
  assert.equal(conflict.status, "conflict");
  const history = await first.pull({
    sessionId: firstSession,
    serverDocumentId: savedA.serverDocumentId,
    sha256: savedA.sha256,
  });
  assert.equal(history.status, "downloaded");
  if (history.status !== "downloaded") throw new Error("Archive pull failed");
  assert.deepEqual(history.file, a);
  assert.equal(
    first.binding(firstSession, document.id)?.baseSha256,
    savedA.sha256,
  );
  const latest = await first.pull({
    sessionId: firstSession,
    serverDocumentId: savedA.serverDocumentId,
  });
  assert.equal(latest.status, "downloaded");
  if (latest.status !== "downloaded") throw new Error("Latest pull failed");
  assert.deepEqual(latest.file, b);
  assert.equal(latest.sha256, savedB.sha256);
  const commits = (await second.list(secondSession)).commits;
  assert.equal(commits.length, 3);
  assert.ok(
    events.some((event) => event.status === 409),
    "No actual HTTP conflict observed",
  );

  const configEntries = unzipSync(b);
  configEntries["files/config.json"] = strToU8(
    JSON.stringify({ consentDate: "2026-10-28" }),
  );
  const configEdited = zipSync(configEntries);
  const savedConfig = await push(
    second,
    configEdited,
    savedA.serverDocumentId,
    savedB.sha256,
  );
  assert.equal(savedConfig.status, "saved");
  if (savedConfig.status !== "saved") throw new Error("Config push failed");
  assert.equal(savedConfig.changed, true);
  assert.notEqual(savedConfig.sha256, savedB.sha256);
  const configDownloaded = await second.pull({
    sessionId: secondSession,
    serverDocumentId: savedA.serverDocumentId,
  });
  assert.equal(configDownloaded.status, "downloaded");
  if (configDownloaded.status !== "downloaded")
    throw new Error("Config pull failed");
  assert.deepEqual(configDownloaded.file, configEdited);

  const manifestEntries = unzipSync(configEdited);
  const manifest = JSON.parse(
    new TextDecoder().decode(manifestEntries["manifest.json"]),
  );
  manifest.document.id = "different-local-document-id";
  manifest.document.title.id = "Changed document title";
  manifestEntries["manifest.json"] = strToU8(JSON.stringify(manifest));
  const manifestEdited = zipSync(manifestEntries);
  const savedManifest = await push(
    second,
    manifestEdited,
    savedA.serverDocumentId,
    savedConfig.sha256,
  );
  assert.equal(savedManifest.status, "saved");
  if (savedManifest.status !== "saved") throw new Error("Manifest push failed");
  assert.equal(savedManifest.changed, false);
  assert.equal(savedManifest.sha256, savedConfig.sha256);
  assert.equal((await second.list(secondSession)).commits.length, 4);
  const manifestDownloaded = await second.pull({
    sessionId: secondSession,
    serverDocumentId: savedA.serverDocumentId,
  });
  assert.equal(manifestDownloaded.status, "downloaded");
  if (manifestDownloaded.status !== "downloaded")
    throw new Error("Manifest pull failed");
  assert.deepEqual(manifestDownloaded.file, configEdited);

  // The server accepts the caller's hash. Prove that pull still detects an old
  // binary checksum and force recovery backs up those exact bytes first.
  const binaryHash = createHash("sha256").update(manifestEdited).digest("hex");
  assert.notEqual(binaryHash, savedManifest.sha256);
  const legacyForm = new FormData();
  legacyForm.append(
    "file",
    new Blob([manifestEdited], { type: "application/x-hightex" }),
    "legacy.hightex",
  );
  const legacyPush = await transport.request("/v2/documents/push", {
    method: "POST",
    body: legacyForm,
    headers: {
      "X-HighTex-SHA256": binaryHash,
      "X-HighTex-Base-SHA256": savedManifest.sha256,
    },
  });
  assert.equal(legacyPush.status, 200);
  await assert.rejects(
    second.pull({
      sessionId: secondSession,
      serverDocumentId: savedA.serverDocumentId,
    }),
    { code: "integrity_failed" },
  );
  assert.equal(
    second.binding(secondSession, document.id)?.baseSha256,
    savedManifest.sha256,
  );
  const recovered = await second.push({
    sessionId: secondSession,
    file: manifestEdited,
    document,
    message: "Recover content fingerprint",
    expectedServerDocumentId: savedA.serverDocumentId,
    expectedCloudSha256: binaryHash,
    replace: false,
    force: true,
  });
  assert.equal(recovered.status, "saved");
  assert.equal(backups.length, 1);
  assert.deepEqual(new Uint8Array(await readFile(backups[0])), manifestEdited);
  const recoveredDownload = await second.pull({
    sessionId: secondSession,
    serverDocumentId: savedA.serverDocumentId,
  });
  assert.equal(recoveredDownload.status, "downloaded");
  if (recoveredDownload.status !== "downloaded")
    throw new Error("Recovery pull failed");
  assert.equal(recoveredDownload.sha256, savedManifest.sha256);
  const finalCommits = (await second.list(secondSession)).commits;
  assert.equal(finalCommits.length, 5, "Current plus at most four archives");
  console.log(
    JSON.stringify(
      {
        server: base,
        actualHTTP: true,
        passed: [
          "authenticated push/pull",
          "content hash roundtrip",
          "profile/photo/export ignored",
          "repacking ignored",
          "mutable-only push changed=false and no new archive",
          "illustration edit changes hash",
          "text edit changes hash",
          "stale device receives HTTP 409",
          "archive pull preserves base",
          "latest pull matches written content",
          "config-only edit creates a new version and roundtrips",
          "different local/server document IDs and manifest metadata do not create a version",
          "legacy binary checksum is rejected on pull",
          "force recovery backs up the exact prior file and restores verified content",
        ],
        serverSnapshots: finalCommits.length,
        requests: events,
      },
      null,
      2,
    ),
  );
} finally {
  const logout = await fetch(server.endpoint("/logout"), {
    method: "DELETE",
    headers: {
      Authorization: "Bearer " + data.token,
      Accept: "application/json",
    },
  });
  assert.equal(logout.status, 200, "Fixture token logout failed");
}
