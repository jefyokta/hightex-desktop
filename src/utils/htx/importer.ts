import { Schema } from "./schema";

export class Importer {
  constructor(private file: File) {
    new Schema(1);
  }

  async import() {}
}
