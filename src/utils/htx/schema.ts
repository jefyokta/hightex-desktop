import { ApplicationError } from "@/exception/interfaces/application-error";
import { SchemaWritter } from "./schema/schema-writter";
import { SchemaReader } from "./schema/schema-reader";
import { V1Reader } from "./schema/v1-reader";
import { V2Reader } from "./schema/v2-reader";

export class Schema<TVersion extends SchemaVersion> {
  public readonly writter: SchemaWritter;
  private file?: File;
  private _reader?: TVersion extends 1 ? V1Reader : V2Reader;
  constructor(
    private version: TVersion,
    private format: ContentFormat = "json",
  ) {
    this.writter = new SchemaWritter();
    this.writter.setContentFormat(this.format);
  }
  setFile(file: File) {
    this.file = file;
  }

  get reader(): TVersion extends 1 ? V1Reader : V2Reader {
    if (this._reader) return this._reader;
    if (!this.file)  throw new ApplicationError("Cannot using reader without assign file");
    
    this._reader = SchemaReader.createReader(this.version, this.file);
    return this.reader;
  }
  createManifest(
    doc: HighTexDocument,
    format: ContentFormat = "json",
  ): HighTexManifestV2 {
    if (this.version == 1) {
      throw new ApplicationError("Creating schema v1 is not supported");
    }
    return {
      format,
      schema_version: 2,
      document: {
        id: doc.id,
        title: {
          id: doc.title,
          en: doc.altTitle,
        },
        category: doc.category,
        keywords: {
          id: doc.keywords.indonesian,
          en: doc.keywords.indonesian,
        },
      },
    };
  }
}
