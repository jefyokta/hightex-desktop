import { V1Reader } from "./v1-reader";
import { V2Reader } from "./v2-reader";

export class SchemaReader {
  static createReader(version: SchemaVersion, file: File) {
    return this.readers(file)[version];
  }

  private static readers(file: File) {
    return {
      1: new V1Reader(file),
      2: new V2Reader(file),
    };
  }
}
