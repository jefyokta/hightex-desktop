import { ApplicationError } from "./interfaces/application-error";

export class ChapterNotFound extends ApplicationError {
  constructor(chapter?: string) {
    super(`Invalid chapter ${chapter}`);
  }
}
