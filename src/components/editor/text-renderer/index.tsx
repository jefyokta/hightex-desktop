import React from "react";
import { JSONContent } from "@tiptap/core";
import { HighTexDB } from "../../../editor/storage/hightex-db";
import { CiteUtils } from "bibtex.js";

async function resolveCite(key?: string) {
  if (!key) return null;

  return await HighTexDB.getInstance().cite.get(key);
}

interface Props {
  texts: JSONContent[];
}

export const TextRenderer = ({ texts }: Props) => {
  return (
    <>
      {texts.map((node, i) => (
        <React.Fragment key={i}>{renderNode(node)}</React.Fragment>
      ))}
    </>
  );
};

function renderNode(node: JSONContent): React.ReactNode {
  if (node.type === "text") {
    return renderText(node);
  }

  if (node.type === "cite") {
    return <CiteNode node={node} />;
  }

  if (!node.content) {
    return null;
  }

  return (
    <>
      {node.content.map((n, i) => (
        <React.Fragment key={i}>{renderNode(n)}</React.Fragment>
      ))}
    </>
  );
}

function renderText(node: JSONContent): React.ReactNode {
  let content: React.ReactNode = node.text || "";

  const marks = node.marks || [];

  for (const mark of marks) {
    switch (mark.type) {
      case "italic":
        content = <i>{content}</i>;
        break;

      case "underline":
        content = <u>{content}</u>;
        break;

      case "strike":
        content = <s>{content}</s>;
        break;
    }
  }

  return content;
}

function CiteNode({ node }: { node: JSONContent }) {
  const [data, setData] = React.useState<CiteUtils | null>(null);

  const key = node.attrs?.cite;
  const citeA = node.attrs?.citeA;

  React.useEffect(() => {
    let alive = true;

    resolveCite(key).then((res) => {
      if (!res) return;
      const c = new CiteUtils(res.bib).setId(res.key);
      if (alive) setData(c);
    });

    return () => {
      alive = false;
    };
  }, [key]);

  if (!data) {
    return <cite data-loading="true">loading...</cite>;
  }

  return (
    <cite
      data-key={key}
      data-a={citeA ? "true" : "false"}
      style={{
        fontStyle: "normal",
        color: citeA ? "#2563eb" : "#6b7280",
        cursor: "pointer",
      }}
    >
      {citeA ? data.toCiteA() : data.toCite()}
    </cite>
  );
}

export async function renderNodeToText(nodes: JSONContent[]): Promise<string> {
  if (!nodes || nodes.length === 0) return "";

  const parts = await Promise.all(
    nodes.map(async (node) => {
      if (!node) return "";

      if (node.type === "text") {
        return renderTextToString(node);
      }

      if (node.type === "cite") {
        const key = node.attrs?.cite;
        const citeA = node.attrs?.citeA;

        const res = await HighTexDB.getInstance().cite.get(key);
        if (!res) return "";

        const c = new CiteUtils(res.bib).setId(res.key);

        return citeA ? c.toCiteA() : c.toCite();
      }

      const content = node.content;

      if (!content || !Array.isArray(content)) {
        return "";
      }

      return await renderNodeToText(content);
    }),
  );

  return parts.join("");
}

function renderTextToString(node: JSONContent): string {
  let content = node.text || "";

  const marks = node.marks || [];

  for (const mark of marks) {
    switch (mark.type) {
      case "italic":
        content = `${content}`;
        break;

      case "underline":
        content = `${content}`;
        break;

      case "strike":
        content = `${content}`;
        break;
    }
  }

  return content;
}
