import { CitationResolver } from "../resolver/citation-resolver";
//@ts-ignore
import Citation from "citation-js";
export class BibliographyBuilder {
  private root: HTMLElement;
  private header: HTMLHeadingElement;

  constructor() {
    this.root = document.createElement("section");
    this.header = document.createElement("h1");
    this.root.classList.add("content", "static-chapter");
    this.header.textContent = "DAFTAR ISI";
    this.header.style.fontSize = "14pt";
    this.header.id = "biblio";
    this.header.style.fontWeight = "700";
    this.header.style.textAlign = "center";
    this.header.style.marginBottom = "10pt";
    this.header.style.marginTop = "10pt";
    this.root.append(this.header);
  }

  create() {
    let entries = "";
    for (const key in CitationResolver.used) {
      entries += CitationResolver.used[key].concat("\n");
    }

    const dp = new Citation(entries);
    const html = dp.format("bibliography", {
      format: "html",
      template: "apa",
    });

    const wrapper = document.createElement("div");
    wrapper.innerHTML = html;
    this.root.append(wrapper);

    return this.root;
  }
}
