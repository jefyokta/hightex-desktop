import { ApplicationError } from "./interfaces/application-error";

export class LayoutError extends ApplicationError {
  constructor() {
    super("Pages are broken please fix before creating pdf!");
  }
}
