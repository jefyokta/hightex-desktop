import { ApplicationError } from "./application-error";

export class ShouldNotifiedWithNativeComponent extends ApplicationError {
  constructor(
    message: string,
    private redirect?: string,
  ) {
    super(message);
    this.redirect = redirect;
  }
  showNotification() {
    alert(this.message);
    if (this.redirect) location.href = this.redirect;
  }
}
