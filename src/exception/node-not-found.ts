import { ApplicationError } from "./interfaces/application-error";

export class NodeNotFound extends ApplicationError {
  constructor(
    message: string,
    readonly nodeTargetName?: string,
    readonly reference?: HTMLElement,
  ) {
    super(message);
  }
}
