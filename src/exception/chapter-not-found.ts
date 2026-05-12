import { ApplicationError } from "./application-error";

export class ChapterNotFound extends ApplicationError {
  constructor(chapter?: string) {
    super(`Invalid chapter ${chapter}`);
  }
}
