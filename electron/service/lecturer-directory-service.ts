import Store from "electron-store";
import { ServerUrl } from "../url/server-url";
import { LecturerDirectoryClient } from "./lecturer-directory-client";
import seed from "../../src/assets/data/lecturer-directory.json";

const store = new Store<{ snapshots: Record<string, unknown> }>({
  name: "lecturer-directory",
  clearInvalidConfig: true,
});
const MAX_BYTES = 4 * 1024 * 1024;

export const lecturerDirectory = new LecturerDirectoryClient({
  source: () => ServerUrl.instance.api.href,
  read: (source) => store.get("snapshots", {})[source],
  write: (source, snapshot) =>
    store.set("snapshots", {
      ...store.get("snapshots", {}),
      [source]: snapshot,
    }),
  seed,
  now: Date.now,
  request: async (source, etag) => {
    const response = await fetch(new URL("lecturers", source), {
      headers: {
        Accept: "application/json",
        ...(etag ? { "If-None-Match": etag } : {}),
      },
      credentials: "omit",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    if (response.status !== 200) return { status: response.status };
    if (Number(response.headers.get("content-length")) > MAX_BYTES)
      throw Error("Directory too large");
    const reader = response.body?.getReader();
    if (!reader) throw Error("Missing directory body");
    const decoder = new TextDecoder();
    let bytes = 0,
      text = "";
    try {
      for (
        let chunk = await reader.read();
        !chunk.done;
        chunk = await reader.read()
      ) {
        bytes += chunk.value.byteLength;
        if (bytes > MAX_BYTES) {
          await reader.cancel();
          throw Error("Directory too large");
        }
        text += decoder.decode(chunk.value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      reader.releaseLock();
    }
    return { status: 200, body: JSON.parse(text) };
  },
});
