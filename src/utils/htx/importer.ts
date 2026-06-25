import { Schema } from "./schema";

export class Importer {
  constructor(private readonly file: File) {
    new Schema(1);
  }

  async import() {
    await this.file.arrayBuffer();
  }
}
