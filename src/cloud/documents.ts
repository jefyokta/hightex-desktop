import { useIPC } from "@/hooks/use-ipc";
import { HighTexDB } from "@/editor/storage/hightex-db";

export type CloudCommit = CommitListResponse["commits"][number];

export interface CloudDocumentsSnapshot {
  session: CloudSession;
  commits: CloudCommit[];
  documents: HighTexDocument[];
  categories: Category[];
  bindings: Record<string, CloudBinding | null>;
}

/** Read one session's cloud slot and its local bindings without changing drafts. */
export async function readCloudDocuments(): Promise<CloudDocumentsSnapshot> {
  const session = await useIPC("hightex").hightex.cloud.context();
  const [response, documents, categories] = await Promise.all([
    useIPC("hightex").hightex.cloud.list(session.sessionId),
    HighTexDB.getMainDocuments(),
    useIPC("hightex").hightex.categories(),
  ]);
  const bindings = Object.fromEntries(await Promise.all(
    documents.map(async document => [
      document.id,
      await useIPC("hightex").hightex.cloud.binding(session.sessionId, document.id),
    ]),
  ));

  return { session, commits: response.commits, documents, categories, bindings };
}
