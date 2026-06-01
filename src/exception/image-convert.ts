import { ShouldNotified } from "./interfaces/should-notified";

export class ImageConvertError extends ShouldNotified {
  constructor(message: string) {
    super({ message: "Image Convert Error", description: message });
  }
}
