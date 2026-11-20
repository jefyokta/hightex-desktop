import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { mathPresentation, MathInlinePresentation } from "./presentation";

export const MathInlineComponent: React.FC<NodeViewProps> = ({ node }) => {
  const content = mathPresentation(String(node.attrs.latex ?? ""), false);

  return (
    <NodeViewWrapper as="span" data-math-inline>
      <MathInlinePresentation html={content.html} />
    </NodeViewWrapper>
  );
};
