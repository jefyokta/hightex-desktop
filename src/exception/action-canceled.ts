import { ShouldNotified } from "./interfaces/should-notified";

export class ActionCanceled extends ShouldNotified {
  constructor(action: string = "") {
    super({ message: "Action Canceled", description: action });
  }
}
