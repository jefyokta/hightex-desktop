import { HighTexDB } from "../storage/hightex-db";
import { SectionLayoutCache } from "@/document-engine/layout/layout-cache";

let current: { database: HighTexDB; cache: SectionLayoutCache } | undefined;

/** Workspace-local application owner; the layout engine receives only the cache port. */
export function documentLayoutCache() {
  const database = HighTexDB.getInstance();
  if (current?.database !== database) {
    current?.cache.clear();
    current = { database, cache: new SectionLayoutCache() };
  }
  return current.cache;
}
