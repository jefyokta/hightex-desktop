import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { CloudAcademicClient } from "../../electron/service/cloud-academic-client";
import type { CloudTransport } from "../../electron/service/cloud-sync-client";
import { readSnapshot } from "../../src/review/snapshot-reader";

// Read-only integration: normalize/validate a copy of the demo artifact in memory.
export const academicScenario = async (
  transport: Pick<CloudTransport, "session" | "request">,
) => {
  const credentials = transport.session();
  assert.ok(credentials);
  const context: CloudSession = {
    sessionId: randomUUID(),
    accountId: credentials.accountId,
    serverUrl: credentials.serverUrl,
  };
  const client = new CloudAcademicClient({
    context: () => context,
    request: transport.request,
  });
  const documentResponse = await transport.request("/document");
  assert.equal(documentResponse.status, 200);
  const owned = (documentResponse.data as { document: { id: string } | null })
    .document;
  const data = await client.load({
    sessionId: context.sessionId,
    serverDocumentId: owned?.id ?? null,
  });
  assert.equal(data.session.accountId, context.accountId);
  assert.ok(data.author.name);
  assert.ok(data.committee.kaprodi.name);
  assert.ok(data.committee.dekan.name);
  const response = await transport.request("/v2/documents/pull");
  assert.equal(response.status, 200);
  assert.ok(response.data instanceof Uint8Array);
  const file = response.data;
  const model = await readSnapshot(file, {
    kind: "local",
    filename: "academic-check.hightex",
  });
  assert.equal(
    model.document.id,
    "codex-sync-fixture",
    "Refusing to process a non-Codex fixture",
  );
  const entries = unzipSync(file);
  entries["files/profile.json"] = strToU8(
    JSON.stringify({
      ...JSON.parse(strFromU8(entries["files/profile.json"])),
      ...data.author,
    }),
  );
  entries["files/config.json"] = strToU8(
    JSON.stringify({
      ...JSON.parse(strFromU8(entries["files/config.json"])),
      ...data.committee,
    }),
  );
  const normalized = zipSync(entries, { mtime: new Date(1980, 0, 1) });
  const input: CloudPushInput = {
    sessionId: context.sessionId,
    document: { ...model.document },
    file: normalized,
    message: "",
    expectedServerDocumentId: data.serverDocumentId,
    expectedCloudSha256: response.headers.get("X-HighTex-SHA256"),
    replace: false,
  };
  await client.verify(input, data.serverDocumentId);
  const snapshot = await readSnapshot(normalized, {
    kind: "local",
    filename: "academic-check.hightex",
  });
  assert.equal(snapshot.document.profile?.name, data.author.name);
  assert.equal(snapshot.document.profile?.advisorName, data.author.advisorName);
  assert.equal(
    snapshot.document.config.kaprodi?.name,
    data.committee.kaprodi.name,
  );
  assert.equal(snapshot.document.config.dekan?.nip, data.committee.dekan.nip);
  const after = await transport.request("/v2/documents/pull");
  assert.deepEqual(after.data, file);
  console.log(
    JSON.stringify({
      cloudAcademic: "passed",
      source: "me.advisors + me.thesis_data + university-data",
      normalizedArtifactVerified: true,
      cloudFileUnchanged: true,
      serverWrites: false,
    }),
  );
};
