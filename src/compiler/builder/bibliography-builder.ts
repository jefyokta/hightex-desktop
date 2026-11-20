import { CitationResolver } from "../resolver/citation-resolver";
import { bibliographyContent } from "./bibliography-content";

export class BibliographyBuilder {
  create() {
    return bibliographyContent(Object.values(CitationResolver.used));
  }
}
