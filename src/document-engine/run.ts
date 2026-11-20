import { TypedEmitter } from "@/event/typed-emitter";
import { abortable } from "@/utils/abortable";
import type { DocumentEngineError } from "@/exception/document-engine-error";
import type {
  DocumentEngineEvents,
  EngineDiagnostic,
  EngineHook,
  EngineNotification,
} from "@/types/document-engine";

type Fields<Key extends keyof DocumentEngineEvents> = Omit<
  DocumentEngineEvents[Key],
  keyof EngineDiagnostic | "sequence" | "signal"
>;

/** One run owns event ordering, cancellation and its single terminal outcome. */
export class DocumentEngineRun {
  private sequence = 0;
  private terminal = false;
  warnings = 0;
  private readonly controller = new AbortController();
  private readonly abort = () => this.controller.abort(this.external.reason);
  diagnostic: EngineDiagnostic;

  constructor(
    private readonly events: TypedEmitter<DocumentEngineEvents>,
    readonly documentId: string,
    private readonly external: AbortSignal,
  ) {
    this.diagnostic = {
      runId: crypto.randomUUID(),
      documentId,
      stage: "start",
    };
    external.addEventListener("abort", this.abort, { once: true });
    if (external.aborted) this.abort();
  }

  get signal() {
    return this.controller.signal;
  }
  get id() {
    return this.diagnostic.runId;
  }

  stage(
    stage: EngineDiagnostic["stage"],
    section?: {
      id: string;
      title: string;
      kind: "editor" | "template";
    },
  ) {
    this.diagnostic = {
      runId: this.id,
      documentId: this.documentId,
      stage,
      ...(section
        ? {
            sectionId: section.id,
            sectionTitle: section.title,
            sectionKind: section.kind,
          }
        : {}),
    };
  }

  async hook<Key extends EngineHook>(event: Key, fields: Fields<Key>) {
    this.signal.throwIfAborted();
    const payload = {
      ...this.diagnostic,
      ...fields,
      signal: this.signal,
      sequence: ++this.sequence,
    } as DocumentEngineEvents[Key];
    await abortable(this.events.emit(event, payload), this.signal);
    this.signal.throwIfAborted();
  }

  async report(error: DocumentEngineError) {
    const previous = this.diagnostic;
    this.diagnostic = { ...error.diagnostic };
    if (error.level === "warning") this.warnings++;
    try {
      await this.hook("diagnostic", { error });
    } finally {
      this.diagnostic = previous;
    }
    if (error.level === "fatal") throw error;
  }

  outcome<Key extends Exclude<EngineNotification, "dispose">>(
    event: Key,
    fields: Fields<Key>,
  ) {
    if (this.terminal) return;
    this.terminal = true;
    const payload = Object.freeze({
      ...this.diagnostic,
      ...fields,
      sequence: ++this.sequence,
    }) as DocumentEngineEvents[Key];
    this.events.notify(event, payload, (error) =>
      this.observerFailed(event, error),
    );
  }

  dispose() {
    this.events.notify(
      "dispose",
      {
        runId: this.id,
        documentId: this.documentId,
        sequence: ++this.sequence,
      },
      (error) => this.observerFailed("dispose", error),
    );
  }

  cancel() {
    this.controller.abort();
  }
  detach() {
    this.external.removeEventListener("abort", this.abort);
  }

  private observerFailed(event: EngineNotification, error: unknown) {
    console.error("Document engine observer failed", {
      runId: this.id,
      event,
      error,
    });
  }
}
