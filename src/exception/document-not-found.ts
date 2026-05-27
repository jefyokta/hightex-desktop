import { Document } from "../editor/document";
import { ApplicationError } from "./interfaces/application-error";

export class DocumentNotFound extends ApplicationError {
  name: string = DocumentNotFound.name;
  constructor(readonly doc: Document) {
    super(`Document [${doc.id}] Not found! `);
  }
}
