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
  interface HighTexManifestV2 {
    format: ContentFormat;
    profile?: Profile;
    schema_version: 2;
    version?: 2;
    document: {
      id: string;
      title?: { id?: string; en?: string };
      keywords?: { id?: string[]; en?: string[] };
      category?: string;
    };
  }
}
