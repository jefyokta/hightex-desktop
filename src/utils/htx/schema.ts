import { SchemaWritter } from "./schema/schema-writter";

/** V2 export schema. Import and validation are provided by @hightex/importer. */
export class Schema {
  public readonly writter: SchemaWritter;
  constructor(format: ContentFormat = "json") {
    this.writter = new SchemaWritter();
    this.writter.setContentFormat(format);
  }
  createManifest(
    doc: HighTexDocument,
    format: ContentFormat = "json",
  ): HighTexManifestV2 {
    return {
      format,
      schema_version: 2,
      version: 2,
      document: {
        id: doc.id,
        title: {
          id: doc.title,
          en: doc.altTitle,
        },
        category: doc.category,
        keywords: {
          id: doc.keywords.indonesian,
          en: doc.keywords.english,
        },
      },
    };
  }
}
