import { unzipSync } from "fflate";

export class Reader<TManifest extends BaseManifest = any> {
  constructor(
    protected file: File,
    protected manifest: TManifest,
  ) {}
  protected async entries() {
    const buffer = await this.file.arrayBuffer();
    return unzipSync(new Uint8Array(buffer));
  }
}
