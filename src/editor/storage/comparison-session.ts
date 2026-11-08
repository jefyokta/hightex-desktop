import { liveQuery } from "dexie";
import { HighTexDB } from "./hightex-db";
import { compareDocumentBranch } from "./document-comparison";
import { contentAssets } from "@/utils/content-assets";
import { isStaticVar } from "@/utils/is-static-var";

const fingerprint = (value: unknown): string =>
  JSON.stringify(value, (_, item) => {
    if (item && typeof item === "object" && !Array.isArray(item))
      return Object.fromEntries(
        Object.entries(item).sort(([a], [b]) => a.localeCompare(b)),
      );
    return item;
  });

/** Watch database snapshots, never editor instances or document/chapter globals. */
export function observeComparisonSources(
  ids: string[],
  onChange: () => void,
  signal: AbortSignal,
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
  const subscription = liveQuery(() =>
    db.transaction(
      "r",
      [
        db.documents,
        db.chapters,
        db.cite,
        db.aliases,
        db.documentVariables,
        db.images,
      ],
      async () => {
        const chapters = await db.chapters
          .where("id")
          .startsWithAnyOf(ids.map((id) => `${id}.`))
          .toArray();
        const assets = contentAssets(chapters);
        const [documents, references, aliases, variables, images] =
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
            db.images
              .filter(
                (row) =>
                  ids.includes(row.documentId ?? "") ||
                  assets.images.has(row.id),
              )
              .toArray(),
          ]);
        return { documents, chapters, references, aliases, variables, images };
      },
    ),
  ).subscribe({
    next: (snapshot) => {
      // Preserve emission order while hashing image bytes outside the database transaction.
      sequence = sequence
        .then(async () => {
          if (stopped) return;
          const images = await Promise.all(
            snapshot.images.map(async (image) => {
              const hash = await crypto.subtle.digest(
                "SHA-256",
                await image.blob.arrayBuffer(),
              );
              return {
                id: image.id,
                type: image.blob.type,
                hash: Array.from(new Uint8Array(hash), (byte) =>
                  byte.toString(16).padStart(2, "0"),
                ).join(""),
              };
            }),
          );
          if (stopped) return;
          const next = fingerprint({ ...snapshot, images });
          if (initial) {
            initial = false;
            baseline = next;
            resolve();
          } else if (next !== baseline) onChange();
        })
        .catch((error) => {
          if (!stopped) {
            reject(error);
            onChange();
          }
        });
    },
    error: (error) => {
      if (!stopped) {
        reject(error);
        onChange();
      }
    },
  });
  const changed = () => {
    if (!stopped) onChange();
  };
  const offProfile = window.profile?.onChange?.(changed);
  const offSession = window.session?.onChange?.(changed);
  const stop = () => {
    if (stopped) return;
    stopped = true;
    subscription.unsubscribe();
    offProfile?.();
    offSession?.();
    signal.removeEventListener("abort", stop);
    reject(new DOMException("Comparison cancelled", "AbortError"));
  };
  signal.addEventListener("abort", stop, { once: true });
  if (signal.aborted) stop();
  return { ready, stop };
}

export async function openDocumentComparison(
  branchId: string,
  onChange: () => void,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  const branch = await HighTexDB.getInstance().documents.get(branchId);
  signal.throwIfAborted();
  if (!branch?.parentId) throw Error("Document is not a branch");
  const ids = [branch.parentId, branchId];
  // Existing windows flush their own bound, ready editor. No new editor or file save.
  await Promise.all(ids.map((id) => window.editor?.flush?.(id)));
  signal.throwIfAborted();
  const observer = observeComparisonSources(ids, onChange, signal);
  try {
    await observer.ready;
    const comparison = await compareDocumentBranch(branchId);
    signal.throwIfAborted();
    if (comparison.main.id !== ids[0]) throw Error("Branch source changed");
    return { comparison, stop: observer.stop };
  } catch (error) {
    observer.stop();
    throw error;
  }
}
