import { JSONContent, Editor } from "@tiptap/core";

type Input = JSONContent | JSONContent[] | null | undefined;

export const ContentFixer = (
  content: Input,
  schema: Editor["schema"],
): JSONContent => {
  let json: any = content;

  if (!json) {
    json = {
      type: "doc",
      content: [{ type: "paragraph" }],
    };
  }

  if (Array.isArray(json)) {
    json = {
      type: "doc",
      content: json,
    };
  }

  if (json.type !== "doc") {
    json = {
      type: "doc",
      content: [json],
    };
  }

  const fixNode = (node: any, parentType: string | null = null): any => {
    if (!node || typeof node !== "object") return null;

    if (node.type === "table" && parentType !== "figureTable") {
      return {
        type: "figureTable",
        content: [
          {
            type: "figcaption",
            content: [
              {
                type: "text",
                text: "Table Caption",
              },
            ],
          },
          {
            type: "table",
            content:
              node.content
                ?.map((c: any) => fixNode(c, "table"))
                .filter(Boolean) || [],
          },
        ],
      };
    }
    if (node.type !== "doc" && !(schema.nodes?.[node.type] ?? false)) {
      return {
        type: "paragraph",
        content:
          node.content
            ?.map((c: any) => fixNode(c, parentType))
            .filter(Boolean) || [],
      };
    }

    if (node.type === "text") {
      return {
        ...node,
        marks: (node.marks || []).filter((m: any) => schema.marks[m.type]),
      };
    }
    if (node.type === "listItem") {
      const rawContent = Array.isArray(node.content) ? node.content : [];

      let content = rawContent
        .map((c: any) => fixNode(c, "listItem"))
        .filter(Boolean);

      const hasParagraph = content.some((c: any) => c.type === "paragraph");

      if (!hasParagraph) {
        const fallbackParagraph =
          content.length > 0
            ? {
                type: "paragraph",
                content: content,
              }
            : {
                type: "paragraph",
                content: [],
              };

        content = [fallbackParagraph];
      }

      content = content.map((c: any) => {
        if (c.type === "text") {
          return {
            type: "paragraph",
            content: [c],
          };
        }
        return c;
      });

      return {
        type: "listItem",
        content,
      };
    }

    const nodeType = schema.nodes?.[node.type];
    if (!nodeType) return null;

    let result: any[] = [];

    if (Array.isArray(node.content)) {
      let match = nodeType.contentMatch;

      for (const child of node.content) {
        const fixedChild = fixNode(child, node.type);

        if (!fixedChild) continue;

        const childType = schema.nodes[fixedChild.type];
        if (!childType) continue;

        const next = match.matchType(childType);
        if (!next) continue;

        result.push(fixedChild);
        match = next;
      }
    }

    return {
      ...node,
      content: result.length ? result : undefined,
    };
  };

  const fixed = fixNode(json);

  return fixed?.content?.length
    ? fixed
    : {
        type: "doc",
        content: [{ type: "paragraph" }],
      };
};
