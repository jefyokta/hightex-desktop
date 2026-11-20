import { ShouldNotified } from "./interfaces/should-notified";

/** A capture cannot continue for this editor revision; the user can retry. */
export class EditorPDFStateError extends ShouldNotified {
  constructor(message: string) {
    super({ message, description: message });
  }
}
