import { ApplicationError } from "@/exception/interfaces/application-error";
import { SchemaWritter } from "./schema/schema-writter";
import { SchemaReader } from "./schema/schema-reader";

export class Schema<TVersion extends SchemaVersion = 2> {
  public readonly writter: SchemaWritter;
  public readonly reader?: SchemaReader;
  constructor(
    private version: TVersion,
    private format: ContentFormat = "json",
    readOption?: {
      file: File;
      manifest: BaseManifest;
    },
  ) {
    this.writter = new SchemaWritter();
    if (readOption) {
      this.reader = new SchemaReader(
        version,
        readOption.file,
        readOption.manifest as any,
      );
    }
    this.writter.setContentFormat(this.format);
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
