import { unzipSync } from "fflate";

export class Reader {
  constructor(protected file: File) {}

  protected async entries() {
    const buffer = await this.file.arrayBuffer();
    return unzipSync(new Uint8Array(buffer));
  }
}
