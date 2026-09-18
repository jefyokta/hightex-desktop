import { Manager } from "@/editor/manager";
import type { JSONContent } from "@tiptap/core";
import { uniqId } from "./uniq-id";

export const migrateGridToTable = async (
  content: JSONContent[],
): Promise<JSONContent[]> => {
  let fixed = 0;
  const id = uniqId()
  const migrate = async (node: JSONContent): Promise<JSONContent> => {
    let result = node;

    switch (node.type) {
      case "grid":
        result = {
          ...node,
          type: "table",
          attrs: {
            ...node.attrs,
            type: "grid",
          },
        };
        break;

      case "gridCell":
        result = {
          ...node,
          type: "tableCell",
          attrs: {
            ...node.attrs,
            type: "grid",
          },
        };
        break;

      case "gridRow":
        result = {
          ...node,
          type: "tableRow",
        };
        break;
    }

    if (result !== node) {
      fixed++;
        Manager.app.dispatch("migrating:deprecation", {
          fixed,
          node: result,
          id,
        });
      
    }

    if (result.content?.length) {
      const content: JSONContent[] = [];

      for (const child of result.content) {
        content.push(await migrate(child));
      }

      result = {
        ...result,
        content,
      };
    }

    return result;
  };

  const result: JSONContent[] = [];

  for (const node of content) {
    result.push(await migrate(node));
  }

  return result;
};