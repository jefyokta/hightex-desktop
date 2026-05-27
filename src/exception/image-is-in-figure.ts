import { ShouldNotified } from "./interfaces/should-notified";

export class ImageIsInFigure extends ShouldNotified {
  constructor() {
    super({
      message: "Action did'nt needed",
      description: "The image is already inside a figure",
    });
  }
}
