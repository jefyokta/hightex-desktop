import { useIPC } from "@/hooks/use-ipc";
import { liveQuery } from "dexie";
import { HighTexDB } from "./hightex-db";
import { contentAssets } from "@/utils/content-assets";
import { isStaticVar } from "@/utils/is-static-var";
import { DocumentImageObserver } from "./document-image-observer";

const fingerprint = (value: unknown): string =>
  JSON.stringify(value, (_, item) => {
    if (item && typeof item === "object" && !Array.isArray(item))
      return Object.fromEntries(
        Object.entries(item).sort(([a], [b]) => a.localeCompare(b)),
      );
    return item;
  });

/** Watch database snapshots, never editor instances or document/chapter globals. */
export function observeDocumentSources(
  ids: string[],
  onChange: () => void,
  signal: AbortSignal,
  options: {
    compareContent?: boolean;
    ignoreFileMetadata?: boolean;
    chapterBuffer?: { id: string; content(): unknown };
  } = {},
) {
  const db = HighTexDB.getInstance();
  let stopped = false;
  let initial = true;
  let baseline: string;
  let sequence = Promise.resolve();
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const ready = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  const changed = () => {
    if (!stopped) onChange();
  };
  const failed = (error: unknown) => {
    if (!stopped) {
      reject(error);
      onChange();
    }
  };
  const images = new DocumentImageObserver(
    db.images, ids, changed, failed, options.compareContent !== false,
  );
  const subscription = liveQuery(() =>
    db.transaction(
      "r",
      [
        db.documents,
        db.chapters,
        db.cite,
        db.aliases,
        db.documentVariables,
      ],
      async () => {
        const chapters = await db.chapters
          .where("id")
          .startsWithAnyOf(ids.map((id) => `${id}.`))
          .toArray();
        const assets = contentAssets(chapters);
        const [documents, references, aliases, variables] =
          await Promise.all([
            db.documents.bulkGet(ids),
            db.cite
              .filter(
                (row) =>
                  !row.documentId ||
                  ids.includes(row.documentId) ||
                  assets.references.has(row.key),
              )
              .toArray(),
            db.aliases.where("documentId").anyOf(ids).toArray(),
            db.documentVariables
              .where("documentId")
              .anyOf(ids)
              .filter((row) => !isStaticVar(row.name))
              .toArray(),
          ]);
        return { documents, chapters, references, aliases, variables, imageIds: assets.images };
      },
    ),
  ).subscribe({
    next: (snapshot) => {
      sequence = sequence
        .then(async () => {
          if (stopped) return;
          const { imageIds, ...source } = snapshot;
          await images.watch(imageIds);
          if (stopped) return;
          if (options.compareContent === false) {
            if (initial) {
              initial = false;
              resolve();
            } else onChange();
            return;
          }
          const buffer = options.chapterBuffer;
          const documents = options.ignoreFileMetadata
            ? snapshot.documents.map(document => {
                if (!document) return document;
                const { updatedAt: _, file: __, ...content } = document;
                return content;
              })
            : buffer
            ? snapshot.documents.map((document) => {
                if (!document) return document;
                const { updatedAt: _, ...content } = document;
                return content;
              })
            : snapshot.documents;
          // Layout needs change detection, not a canonical archive digest. Native
          // JSON comparison avoids sorting every nested authored attribute on
          // each save; different key order can only cause a safe invalidation.
          const chapters = buffer
            ? snapshot.chapters.map((chapter) =>
                chapter.id === buffer.id &&
                JSON.stringify(chapter.content) ===
                  JSON.stringify(buffer.content())
                  ? { id: chapter.id, content: "current editor buffer" }
                  : chapter,
              )
            : snapshot.chapters;
          const next = (buffer ? JSON.stringify : fingerprint)({
            ...source,
            documents,
            chapters,
          });
          if (initial) {
            initial = false;
            baseline = next;
            resolve();
          } else if (next !== baseline) {
            baseline = next;
            onChange();
          }
        })
        .catch(failed);
    },
    error: failed,
  });
  const offProfile = useIPC("profile").profile?.onChange?.(changed);
  const offSession = useIPC("session").session?.onChange?.(changed);
  const stop = () => {
    if (stopped) return;
    stopped = true;
    subscription.unsubscribe();
    images.dispose();
    offProfile?.();
    offSession?.();
    signal.removeEventListener("abort", stop);
    reject(new DOMException("Comparison cancelled", "AbortError"));
  };
  signal.addEventListener("abort", stop, { once: true });
  if (signal.aborted) stop();
  return { ready, stop };
}
