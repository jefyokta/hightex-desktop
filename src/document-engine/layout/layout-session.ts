import { TypedEmitter } from "@/event/typed-emitter";
import {
  sectionLayoutKey,
  type SectionLayoutIdentity,
  type SectionLayoutResult,
} from "../../../shared/section-layout";
import { freezeSectionLayout } from "./publish-layout";

export type LayoutInvalidationReason =
  | "source"
  | "options"
  | "resources"
  | "presentation"
  | "cancel";
interface SectionLayoutJob {
  readonly identity: SectionLayoutIdentity;
  readonly signal: AbortSignal;
  readonly generation: number;
}
interface ActiveLayout {
  job: SectionLayoutJob;
  controller: AbortController;
  detach: () => void;
}

/** Own one section's pending/current revision; document phase events remain DocumentEngine-owned. */
export class SectionLayoutSession {
  private readonly emitter = new TypedEmitter<{
    "layout.invalidated": {
      readonly generation: number;
      readonly reason: LayoutInvalidationReason;
      readonly previous?: SectionLayoutIdentity;
    };
  }>();
  readonly events: Pick<typeof this.emitter, "on" | "off" | "once"> =
    this.emitter;
  private active?: ActiveLayout;
  private publishedIdentity?: Readonly<SectionLayoutIdentity>;
  private disposed = false;
  private generation = 0;

  constructor(private readonly reportObserverError: (error: unknown) => void) {}

  begin(
    identity: SectionLayoutIdentity,
    signal?: AbortSignal,
  ): SectionLayoutJob {
    if (this.disposed) throw Error("Section layout session is disposed");
    signal?.throwIfAborted();
    const input = Object.freeze({ ...identity });
    this.cancelActive(
      new DOMException("Section layout superseded", "AbortError"),
    );
    const controller = new AbortController();
    const job = Object.freeze({
      identity: input,
      signal: controller.signal,
      generation: ++this.generation,
    });
    const aborted = () => {
      if (this.active?.job === job) this.invalidate("cancel", signal!.reason);
    };
    this.active = {
      job,
      controller,
      detach: () => signal?.removeEventListener("abort", aborted),
    };
    signal?.addEventListener("abort", aborted, { once: true });
    return job;
  }

  publish(job: SectionLayoutJob, result: SectionLayoutResult) {
    job.signal.throwIfAborted();
    if (
      this.active?.job !== job
    )
      throw new DOMException(
        "Stale section layout cannot be published",
        "AbortError",
      );
    if (sectionLayoutKey(job.identity) !== sectionLayoutKey(result.identity))
      throw Error("Section layout result does not match its input identity");
    const frozen = freezeSectionLayout(result);
    this.active.detach();
    this.active = undefined;
    this.publishedIdentity = frozen.identity;
    return frozen;
  }

  invalidate(
    reason: LayoutInvalidationReason,
    cause: unknown = new DOMException(
      "Section layout invalidated",
      "AbortError",
    ),
  ) {
    if (this.disposed) return;
    const previous = this.active?.job.identity ?? this.publishedIdentity;
    ++this.generation;
    this.cancelActive(cause);
    this.emitter.notify(
      "layout.invalidated",
      Object.freeze({ generation: this.generation, reason, previous }),
      this.reportObserverError,
    );
  }

  private cancelActive(reason: unknown) {
    const active = this.active;
    this.active = undefined;
    active?.detach();
    active?.controller.abort(reason);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.publishedIdentity = undefined;
    this.cancelActive(
      new DOMException("Section layout session disposed", "AbortError"),
    );
    this.emitter.clear();
  }
}
