import { liveQuery, type Subscription, type Table } from "dexie";
import { sha256Bytes } from "@/utils/sha256";

/** Own image-table observation independently of chapter autosaves. */
export class DocumentImageObserver {
  private subscription?: Subscription;
  private scope?: string;
  private baseline?: string;
  private generation = 0;
  private ready?: Promise<void>;
  private cancelReady?: () => void;

  constructor(
    private readonly images: Table<ImageRecord, string>,
    private readonly documentIds: readonly string[],
    private readonly onChange: () => void,
    private readonly onError: (error: unknown) => void,
    private readonly compareContent: boolean,
  ) {}

  watch(references: ReadonlySet<string>): Promise<void> {
    const scope = JSON.stringify([...references].sort());
    if (scope === this.scope) return this.ready!;
    this.release();
    this.scope = scope;
    const generation = this.generation;
    // Capture membership for this subscription; later source emissions cannot mutate it.
    const referenced = new Set(references);
    let sequence = Promise.resolve();
    this.ready = new Promise<void>((resolve, reject) => {
      let initialized = false;
      const failed = (error: unknown) => {
        if (generation !== this.generation) return;
        if (initialized) this.onError(error);
        else reject(error);
      };
      this.cancelReady = () => reject(new DOMException("Comparison cancelled", "AbortError"));
      this.subscription = liveQuery(() =>
        this.images.filter(image =>
          this.documentIds.includes(image.documentId ?? "") || referenced.has(image.id),
        ).toArray(),
      ).subscribe({
        next: images => {
          // Hash outside IDB, retaining delivery order for replacements during a read.
          sequence = sequence.then(async () => {
            if (generation !== this.generation) return;
            const identities = this.compareContent
              ? await Promise.all(images.map(async image => ({
                  id: image.id,
                  type: image.blob.type,
                  hash: await sha256Bytes(new Uint8Array(await image.blob.arrayBuffer())),
                })))
              : [];
            if (generation !== this.generation) return;
            const next = JSON.stringify(identities);
            if (this.baseline !== undefined &&
                (!this.compareContent || next !== this.baseline)) this.onChange();
            this.baseline = next;
            initialized = true;
            resolve();
          }).catch(failed);
        },
        error: failed,
      });
    });
    return this.ready;
  }

  private release() {
    this.generation++;
    this.subscription?.unsubscribe();
    this.cancelReady?.();
    this.subscription = undefined;
    this.cancelReady = undefined;
  }

  dispose() {
    this.release();
    this.scope = undefined;
    this.ready = undefined;
  }
}
