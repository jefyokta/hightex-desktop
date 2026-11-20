import { Parser, type NodeI } from "tjsn-parser";
import { assertSupportedContent } from "@/utils/document-content";

// Legacy Paged.js only. Experimental export renders the editor schema directly.
class LegacyDocumentParser extends Parser {
  override render(nodes: NodeI[], appendTo: HTMLElement) {
    assertSupportedContent(nodes);
    return super.render(nodes, appendTo);
  }
}

/** Fail explicitly on removed content instead of silently dropping its subtree. */
export function createLegacyDocumentParser(): Parser {
  return new LegacyDocumentParser();
}
