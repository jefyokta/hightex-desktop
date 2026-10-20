import { Fragment, type ReactNode } from "react";
import type { JSONContent } from "@tiptap/core";
import katex from "katex";
import type { SnapshotReadModel } from "@/review/snapshot-reader";
import { applyCase } from "@/utils/apply-var-case";
import type { VariableCase } from "@/editor/extensions/variable";
import { formatInTextCitation, formatManual } from "@/utils/citation";
import { t } from "@/utils/lang";

interface Props {
  snapshot: SnapshotReadModel;
  nodes: readonly JSONContent[];
  images: ReadonlyMap<string, string>;
}

const bound = (value: unknown, fallback: number, maximum: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(1, Math.min(maximum, Math.round(value)))
    : fallback;

export const SnapshotContent = ({ snapshot, nodes, images }: Props) => {
  const render = (node: JSONContent): ReactNode => {
    const attrs = node.attrs ?? {};
    const children = node.content?.map((child, index) => (
      <Fragment key={index}>{render(child)}</Fragment>
    ));
    const elementId =
      typeof attrs.id === "string"
        ? `snapshot-${snapshot.sha256}-${attrs.id}`
        : undefined;
    switch (node.type) {
      case "text": {
        let text: ReactNode = node.text ?? "";
        for (const mark of node.marks ?? []) {
          switch (mark.type) {
            case "bold":
              text = <strong>{text}</strong>;
              break;
            case "italic":
              text = <em>{text}</em>;
              break;
            case "underline":
              text = <u>{text}</u>;
              break;
            case "strike":
              text = <s>{text}</s>;
              break;
            case "code":
              text = <code>{text}</code>;
              break;
            case "subscript":
              text = <sub>{text}</sub>;
              break;
            case "superscript":
              text = <sup>{text}</sup>;
              break;
            case "note":
              text = (
                <abbr
                  title={
                    typeof mark.attrs?.note === "string"
                      ? mark.attrs.note
                      : undefined
                  }
                >
                  {text}
                </abbr>
              );
              break;
          }
        }
        return text;
      }
      case "doc":
        return <>{children}</>;
      case "paragraph":
        return <p id={elementId}>{children || <br />}</p>;
      case "heading": {
        const Tag = `h${bound(attrs.level, 2, 6)}` as
          | "h1"
          | "h2"
          | "h3"
          | "h4"
          | "h5"
          | "h6";
        return <Tag id={elementId}>{children}</Tag>;
      }
      case "hardBreak":
        return <br />;
      case "horizontalRule":
        return <hr />;
      case "bulletList":
        return <ul>{children}</ul>;
      case "orderedList":
        return <ol start={bound(attrs.start, 1, 10000)}>{children}</ol>;
      case "listItem":
        return <li>{children}</li>;
      case "blockquote":
        return <blockquote>{children}</blockquote>;
      case "codeBlock":
        return (
          <pre>
            <code>{children}</code>
          </pre>
        );
      case "figure":
      case "imageFigure":
      case "figureTable":
        return <figure id={elementId}>{children}</figure>;
      case "figcaption":
        return <figcaption>{children}</figcaption>;
      case "table":
      case "grid":
        return (
          <table>
            <tbody>{children}</tbody>
          </table>
        );
      case "tableRow":
      case "gridRow":
        return <tr>{children}</tr>;
      case "tableHeader":
      case "tableCell":
      case "gridCell": {
        const Tag = node.type === "tableHeader" ? "th" : "td";
        return (
          <Tag
            colSpan={bound(attrs.colspan, 1, 100)}
            rowSpan={bound(attrs.rowspan, 1, 100)}
            style={{
              textAlign:
                attrs.align === "center"
                  ? "center"
                  : attrs.align === "right"
                    ? "right"
                    : "left",
            }}
          >
            {children}
          </Tag>
        );
      }
      case "image": {
        const source = typeof attrs.src === "string" ? attrs.src : "";
        const url =
          images.get(source) ??
          (/^data:image\/(png|jpe?g|webp);base64,[a-z0-9+/=\r\n]+$/i.test(
            source,
          )
            ? source
            : undefined);
        return url ? (
          <img
            src={url}
            width={bound(attrs.width, 400, 800)}
            alt={typeof attrs.alt === "string" ? attrs.alt : ""}
          />
        ) : (
          <span className="text-muted-foreground">
            [{t("submission_review.missing_image")}]
          </span>
        );
      }
      case "variable": {
        const name = typeof attrs.name === "string" ? attrs.name : "";
        const value = applyCase(
          snapshot.variable(name),
          attrs.case as VariableCase,
        );
        return (
          <span title={value ? undefined : t("submission_review.not_recorded")}>
            {value || `[${name || "?"}]`}
          </span>
        );
      }
      case "dots":
        return <>...</>;
      case "mathInline":
      case "blockMath": {
        const latex = typeof attrs.latex === "string" ? attrs.latex : "";
        const html = katex.renderToString(latex, {
          throwOnError: false,
          displayMode: node.type === "blockMath",
          trust: false,
          maxExpand: 1000,
          maxSize: 10,
        });
        return node.type === "blockMath" ? (
          <div id={elementId} dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <span dangerouslySetInnerHTML={{ __html: html }} />
        );
      }
      case "cite": {
        if (attrs.manual)
          return (
            <span>
              {formatManual(
                typeof attrs.text === "string" ? attrs.text : "",
                typeof attrs.year === "string" ? attrs.year : "",
                Boolean(attrs.citeA),
              )}
            </span>
          );
        const keys =
          typeof attrs.cite === "string" ? attrs.cite.split("|") : [];
        const citations = keys
          .filter((key) => snapshot.references[key] !== undefined)
          .map((key) => ({ key, bib: snapshot.references[key] }));
        let label = `[${keys.join("; ") || "?"}]`;
        if (citations.length === keys.length && citations.length) {
          try {
            label = formatInTextCitation(
              citations,
              Boolean(attrs.citeA),
            ).inText;
          } catch {
            /* Keep the original reference keys visible. */
          }
        }
        return <cite>{label}</cite>;
      }
      case "ref":
      case "refComponent": {
        const label =
          typeof attrs.label === "string" && attrs.label
            ? attrs.label
            : typeof attrs.link === "string"
              ? attrs.link
              : "?";
        return typeof attrs.link === "string" ? (
          <a href={`#snapshot-${snapshot.sha256}-${attrs.link}`}>{label}</a>
        ) : (
          <span>{label}</span>
        );
      }
      default:
        return (
          <div>
            <span className="text-muted-foreground">
              [{t("submission_review.unsupported_node", { type: node.type })}]
            </span>
            {children}
          </div>
        );
    }
  };
  return (
    <div className="snapshot-content">
      {nodes.map((node, index) => (
        <Fragment key={index}>{render(node)}</Fragment>
      ))}
    </div>
  );
};
