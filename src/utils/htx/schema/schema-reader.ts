import { strFromU8, unzipSync } from "fflate";

import { HighTexImportError } from "@/exception/hightex-import";
import { V2Reader } from "./v2-reader";
import { V1Reader } from "./v1-reader";

export class SchemaReader<TVersion extends SchemaVersion = any> {
  private _reader: TVersion extends 1 ? V1Reader : V2Reader;

  get reader() {
    return this._reader;
  }

  constructor(
    version: TVersion,
    file: File,
    manifest: TVersion extends 1 ? HighTexManifest : HighTexManifestV2,
  ) {

    const readerMap = SchemaReader.readers(file, manifest);
    this._reader = readerMap[version] as TVersion extends 1
      ? V1Reader
      : V2Reader;
  }

  static async getManifestFile(file: File): Promise<BaseManifest> {
    const unziped = unzipSync(new Uint8Array(await file.arrayBuffer()));
    const manifest = Object.keys(unziped).find((k) =>
      k.endsWith("manifest.json"),
    );

    if (!manifest) {
      throw new HighTexImportError("Cannot find the manifest file");
    }

    try {
      const manifestObj: BaseManifest = JSON.parse(
        strFromU8(unziped[manifest]),
      );
      return manifestObj;
    } catch (error) {
      throw new HighTexImportError("Manifest file is broken");
    }
  }

  static async getVersion(file: File): Promise<SchemaVersion> {
    return (await this.getManifestFile(file)).schema_version;
  }

  private static readers(file: File, manifest: BaseManifest) {
    return {
      1: new V1Reader(file, manifest as HighTexManifest),
      2: new V2Reader(file, manifest as HighTexManifestV2),
    };
  }
}
