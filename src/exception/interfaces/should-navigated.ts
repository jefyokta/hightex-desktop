import { ApplicationError } from "./application-error";

export class ShouldNavigated extends ApplicationError {
  constructor(
    message: string,
    public readonly navigateTo = "/",
  ) {
    super(message);
  }
}
