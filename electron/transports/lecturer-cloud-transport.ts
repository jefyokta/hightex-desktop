import { ServerUrl } from "../url/server-url";
import { MAX_LECTURER_IMPORT_BYTES } from "../../src/utils/lecturer-import";
import type { LecturerCloudSession } from "../clients/lecturer-cloud-client";

/** No response bodies, tokens, or lecturer identities are logged. */
export async function requestCloudLecturers(session: LecturerCloudSession) {
  const response = await fetch(
    new ServerUrl(session.serverUrl).endpoint("lecturers"),
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${session.token}`,
      },
      credentials: "omit",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    },
  );
  if (response.status !== 200) {
    await response.body?.cancel();
    return { status: response.status };
  }
  if (
    Number(response.headers.get("content-length")) > MAX_LECTURER_IMPORT_BYTES
  ) {
    await response.body?.cancel();
    return { status: 200, data: null };
  }
  const reader = response.body?.getReader();
  if (!reader) return { status: 200, data: null };
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
      if (bytes > MAX_LECTURER_IMPORT_BYTES) {
        await reader.cancel();
        return { status: 200, data: null };
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    try {
      return { status: 200, data: JSON.parse(text) as unknown };
    } catch {
      return { status: 200, data: null };
    }
  } finally {
    reader.releaseLock();
  }
}
