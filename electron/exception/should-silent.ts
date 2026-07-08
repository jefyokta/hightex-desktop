import { Handled } from "./interface/handled";

export class ShouldSilent extends Handled {
  protected rendererErrorClass = "ShouldSilent";
  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
    this.message = `${this.rendererErrorClass}:${message}`;
  }
}
