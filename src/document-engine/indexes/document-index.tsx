import "@/css/document-index.css";
import { renderToStaticMarkup } from "react-dom/server";
import type { SectionOutline, TemplateSection } from "@/types/document-engine";

function IndexRow({ entry, label }: { entry: SectionOutline; label: string }) {
  const heading = entry.kind === "heading";
  const level = heading ? entry.level : 2;
  const row = <a
    href={`#${entry.id}`}
    data-heading-id={heading ? entry.id : undefined}
    data-caption-id={heading ? undefined : entry.id}
    data-section-group={entry.group}
    className={["toc-row", level === 2 ? "sub" : level === 3 ? "subsub" : "", entry.number ? "" : "unnumbered"].join(" ").trim()}
  >
    {entry.number && <div className="toc-number">{entry.number}</div>}
    <div className="toc-inner">
      <span className="toc-text" dangerouslySetInnerHTML={{ __html: entry.titleHTML }} />
      <span className="toc-dots" />
    </div>
    <span className="toc-page">{label}</span>
  </a>;
  return heading ? <div>{row}</div> : row;
}

/** Outline data only; renderers own extraction and the engine owns page labels. */
export class DocumentIndex {
  private readonly entries: SectionOutline[] = [];
  private readonly targets = new Set<string>();
  collect(entries: readonly SectionOutline[]) {
    for (const entry of entries)
      if (!this.targets.has(entry.id)) {
        this.targets.add(entry.id);
        this.entries.push(entry);
      }
  }

  html(section: TemplateSection, labels: ReadonlyMap<string, string>): string {
    const entries = this.entries.filter((entry) =>
      section.index === "toc"
        ? entry.kind === "heading"
        : section.index === "tof"
          ? entry.kind === "imageFigure"
          : entry.kind === "figureTable",
    );
    return renderToStaticMarkup(<>
      <h1 id={section.id} className="chapter">{section.title}</h1>
      {entries.map(entry => <IndexRow key={entry.id} entry={entry} label={labels.get(entry.id) ?? ""} />)}
    </>);
  }
}
