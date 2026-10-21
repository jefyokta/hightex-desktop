import { strict as assert } from "node:assert";
import {
  CloudSyncClient,
  type CloudTransport,
} from "../../electron/service/cloud-sync-client";
import { readSnapshot } from "../../src/review/snapshot-reader";
import { emptyAuthorProfile } from "../../src/utils/document-profile";
import { writeProfileEntries } from "../../src/utils/htx/profile";
import { Schema } from "../../src/utils/htx/schema";
import { zipSync } from "fflate";

export const syncScenario = async (
  transport: Pick<CloudTransport, "session" | "request">,
) => {
  const response = await transport.request("/categories");
  assert.equal(response.status, 200);
  const categories = (response.data as { data: Category[] }).data;
  const category = categories.find((category) => category.variant !== "intern");
  assert.ok(category, "No supported demo category");
  const doc: HighTexDocument = {
    id: "codex-sync-fixture",
    title: "Codex sync demo",
    altTitle: "Cloud sync fixture",
    category: String(category.id),
    keywords: { indonesian: ["demo"], english: ["demo"] },
    config: {},
    profile: {
      ...emptyAuthorProfile(),
      name: "Demo document author",
      nim: "DEMO",
      cv: "<p>Demo document CV</p>",
    },
  };
  const makeFile = async (version: string) => {
    const schema = new Schema(2);
    schema.writter.putManifest(schema.createManifest(doc));
    schema.writter.putConfig(doc.config);
    schema.writter.putChapter("1", [
      {
        type: "paragraph",
        content: [
          { type: "text", text: `Server integration version ${version}` },
          { type: "variable", attrs: { name: "name" } },
        ],
      },
    ]);
    schema.writter.putVariables([]);
    schema.writter.putAliases([]);
    schema.writter.putReference([]);
    return zipSync(
      {
        ...schema.writter.getEntries(),
        ...(await writeProfileEntries(doc.profile!)),
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
      backup: async () => {
        throw new Error("Integration never replaces occupied slots");
      },
    });
  };
  const first = makeClient();
  const session = first.context();
  const initial = await first.list(session.sessionId);
  assert.equal(
    initial.commits.length,
    0,
    "Refusing to overwrite an existing demo cloud slot",
  );
  const a = await makeFile("A");
  const b = await makeFile("B");
  const push = async (
    client: CloudSyncClient,
    file: Uint8Array,
    serverId: string | null,
    currentSha: string | null,
  ) =>
    client.push({
      sessionId: client.context().sessionId,
      file,
      document: doc,
      message: "Codex local integration fixture",
      expectedServerDocumentId: serverId,
      expectedCloudSha256: currentSha,
      replace: false,
    });
  const savedA = await push(first, a, null, null);
  assert.equal(savedA.status, "saved");
  if (savedA.status !== "saved") throw new Error("Initial push failed");
  const second = makeClient();
  const secondSession = second.context();
  const downloadedA = await second.pull({
    sessionId: secondSession.sessionId,
    serverDocumentId: savedA.serverDocumentId,
  });
  assert.equal(downloadedA.status, "downloaded");
  if (downloadedA.status !== "downloaded") throw new Error("Pull failed");
  assert.deepEqual(downloadedA.file, a);
  const readA = await readSnapshot(downloadedA.file, {
    kind: "local",
    filename: "integration.hightex",
  });
  assert.equal(readA.document.profile?.name, doc.profile?.name);
  second.accept({
    sessionId: secondSession.sessionId,
    downloadId: downloadedA.downloadId,
    localDocumentId: doc.id,
  });
  const savedB = await push(second, b, savedA.serverDocumentId, savedA.sha256);
  assert.equal(savedB.status, "saved");
  if (savedB.status !== "saved") throw new Error("Second device push failed");
  await first.list(session.sessionId);
  assert.equal(
    first.binding(session.sessionId, doc.id)?.baseSha256,
    savedA.sha256,
  );
  const conflict = await push(
    first,
    await makeFile("local C"),
    savedA.serverDocumentId,
    savedB.sha256,
  );
  assert.equal(conflict.status, "conflict");
  const history = await first.pull({
    sessionId: session.sessionId,
    serverDocumentId: savedA.serverDocumentId,
    sha256: savedA.sha256,
  });
  assert.equal(history.status, "downloaded");
  assert.equal(
    first.binding(session.sessionId, doc.id)?.baseSha256,
    savedA.sha256,
  );
  const latest = await first.pull({
    sessionId: session.sessionId,
    serverDocumentId: savedA.serverDocumentId,
  });
  assert.equal(latest.status, "downloaded");
  if (latest.status !== "downloaded") throw new Error("Latest pull failed");
  assert.deepEqual(latest.file, b);
  first.accept({
    sessionId: session.sessionId,
    downloadId: latest.downloadId,
    localDocumentId: doc.id,
  });
  const unchanged = await push(
    first,
    b,
    savedA.serverDocumentId,
    savedB.sha256,
  );
  assert.equal(unchanged.status, "saved");
  if (unchanged.status === "saved") assert.equal(unchanged.changed, false);
  console.log(
    JSON.stringify({
      cloudSync: "passed",
      verifiedRoundTrip: true,
      simulatedDevices: 2,
      staleBaseConflict: true,
      historyPreservesBase: true,
      unchangedArtifact: true,
      demoCloudLeftAt: "B",
      submissionCreated: false,
    }),
  );
};
