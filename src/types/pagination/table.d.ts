import type { Node as ModelNode } from "@tiptap/pm/model";
import type { FlowLine } from "@/editor/pagination/flow/text-flow";

declare global {
  interface PaginationTableRow {
    from: number;
    node: ModelNode;
    element: HTMLElement;
    height: number;
  }

  interface PaginationTableCell {
    row: number;
    end: number;
    from: number;
    node: ModelNode;
    lines: FlowLine[];
    nested: {
      node: ModelNode;
      pos: number;
      container: number;
      done: boolean;
    }[];
  }
}

export {};
