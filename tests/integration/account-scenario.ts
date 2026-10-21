import assert from "node:assert/strict";
import { AccountClient } from "../../electron/service/account-client";
import type { SubmissionClient } from "../../electron/service/submission-client";
export const accountScenario = async (
  transport: {
    request(
      endpoint: string,
      options?: RequestInit,
    ): Promise<{ ok: boolean; status: number; data: unknown }>;
  },
  submissions: SubmissionClient,
) => {
  const client = new AccountClient({
    open: async () => {},
    context: () => submissions.context(),
    request: (endpoint, options) => transport.request(endpoint, options),
    image: async (url) => {
      const response = await fetch(url, { redirect: "error" });
      return {
        ok: response.ok,
        type: response.headers.get("Content-Type")?.split(";")[0] ?? "",
        bytes: new Uint8Array(await response.arrayBuffer()),
      };
    },
    accept: async () => {},
  });
  const loaded = await client.load();
  if (!loaded.ok) throw Error(`Account load: ${loaded.error}`);
  const original = loaded.data;
  const saved = await client.update({
    sessionId: original.session.sessionId,
    cv: original.cv ?? "",
  });
  if (!saved.ok) throw Error(`Account save: ${saved.error}`);
  assert.equal(saved.data.cv ?? "", original.cv ?? "");
  assert.equal(saved.data.name, original.name);
  assert.equal(saved.data.picturePath, original.picturePath);
  const invalid = await client.update({
    sessionId: original.session.sessionId,
    image: {
      bytes: new Uint8Array([1, 2, 3]),
      type: "image/png",
      name: "invalid.png",
    },
  });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) {
    assert.equal(invalid.error, "validation");
    assert.ok(invalid.fields?.image?.length);
  }
  console.log(
    JSON.stringify({
      accountProfile: "verified",
      sameCVSaved: true,
      originalPhotoPreserved: true,
      imageValidation422: true,
    }),
  );
};
