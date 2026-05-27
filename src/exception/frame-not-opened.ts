import { ShouldNotified } from "./interfaces/should-notified";

export class FrameNotOpened extends ShouldNotified<"warning"> {
  // level: "warning";
  readonly level: "warning" = "warning";
}
