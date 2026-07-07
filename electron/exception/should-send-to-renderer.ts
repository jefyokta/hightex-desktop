import { Handled } from "./interface/handled";

export class ShouldSendToRenderer extends Handled {
  protected rendererErrorClass = "ShouldNotified"
  constructor(message?: string, options?: ErrorOptions){
    super(message,options)
    this.message = `${this.rendererErrorClass}:${message}`
  }
  handle(): void {
   
  }
}