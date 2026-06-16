export {};

declare global {
  type HighTexFileExt =
    /**
     * dynamic content
     */
    | "hightex"
    /** json content */
    | "ht"
    /** ht content */
    | "htx";
  interface ExportOptions {
    format: ContentFormat;
    ext: HighTexFileExt;
  }
  type ContentFormat = "ht" | "json";
  type SchemaVersion = 1 | 2;
  interface BaseManifest {
    schema_version: SchemaVersion;
  }
  interface HighTexManifestV2 extends BaseManifest {
    format: ContentFormat;
    schema_version: 2;
    document: {
      id: string;
      title?: { id?: string; en?: string };
      keywords?: { id?: string[]; en?: string[] };
      category?: string;
    };
  }
  type ImportContext = {
    file: File;
    buffer: ArrayBuffer;
    entries: Record<string, Uint8Array>;
    manifest: HighTexManifestV2;
    documentId: string;
    actualDocumentId: string;
    exists: boolean;
    db: HighTexDB;
  };

  //soon will be removed
  interface HighTexManifest extends BaseManifest {
    document: {
      id: string;
      title: {
        main: string;
        alt?: string;
      };
      keywords?: {
        indonesian?: string[];
        english?: string[];
      };
      category?: {
        name?: string;
        chapters?: number;
      };
    };
    structure?: {
      chapters?: Array<{ file: string; id: string }>;
      assets?: string[];
      excluded?: string[];
    };
  }

  type ImportContextV1 = {
    file: File;
    buffer: ArrayBuffer;
    entries: Record<string, Uint8Array>;
    manifest: HighTexManifest;
    documentId: string;
    actualDocumentId: string;
    exists: boolean;
    db: HighTexDB;
  };
}
