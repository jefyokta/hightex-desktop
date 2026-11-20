import { Manager } from "@/editor/manager";
import type { JSONContent } from "@tiptap/core";
import { uniqId } from "./uniq-id";
import { migrateGridContent } from "@/editor/extensions/table/legacy-content";

export const migrateGridToTable = async (
  content: JSONContent[],
): Promise<JSONContent[]> => {
  let fixed = 0;
  const id = uniqId();
  return migrateGridContent(content, (node) => {
    Manager.app.dispatch("migrating:deprecation", { fixed: ++fixed, node, id });
  });
};
