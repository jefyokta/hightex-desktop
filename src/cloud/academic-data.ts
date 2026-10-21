import { HighTexDB } from "@/editor/storage/hightex-db";
import { Exporter } from "@/utils/htx/exporter";

const sameScope = (
  source: CloudAcademicSource | undefined,
  session: CloudSession,
) =>
  !source ||
  (source.accountId === session.accountId &&
    source.serverUrl === session.serverUrl);

/** Prepare a cloud artifact without rewriting an unrelated local author's data. */
export const exportCloudArtifact = async (
  id: string,
  session: CloudSession,
  serverDocumentId: string | null,
) => {
  const document = await HighTexDB.getInstance().documents.get(id);
  if (
    !document ||
    !sameScope(document.cloudAcademic, session) ||
    (serverDocumentId &&
      document.cloudAcademic &&
      document.cloudAcademic.serverDocumentId !== serverDocumentId)
  )
    throw new Error("cloud_error:academic_scope");
  const academic = await window.hightex.cloud.academic.load({
    sessionId: session.sessionId,
    serverDocumentId,
  });
  if ((await window.hightex.cloud.context()).sessionId !== session.sessionId)
    throw new Error("cloud_error:session_changed");
  return { ...(await new Exporter(id).exportForPush(academic)), academic };
};

/** Only a bound working document is refreshed. Review/archive readers never call this. */
export const refreshCloudAcademic = async (id: string) => {
  const db = HighTexDB.getInstance();
  const document = await db.documents.get(id);
  let locked = Boolean(document?.cloudAcademic);
  try {
    locked = locked || (await window.hightex.cloud.academic.locked(id));
    if (!locked) return { locked: false };
    const session = await window.hightex.cloud.context();
    const binding = await window.hightex.cloud.binding(session.sessionId, id);
    if (!binding || !sameScope(document?.cloudAcademic, session))
      return { locked: true, error: "academic_scope" };
    const categories = await window.hightex.categories();
    if (
      document?.config.intern ||
      categories.find((item) => String(item.id) === document?.category)
        ?.variant === "intern"
    )
      return { locked: true, error: "kp_unsupported" };
    const data = await window.hightex.cloud.academic.load({
      sessionId: session.sessionId,
      serverDocumentId: binding.serverDocumentId,
    });
    if ((await window.hightex.cloud.context()).sessionId !== session.sessionId)
      throw new Error("cloud_error:session_changed");
    await db.cacheCloudAcademic(id, data);
    return { locked: true };
  } catch {
    return { locked, error: "academic_unavailable" };
  }
};
