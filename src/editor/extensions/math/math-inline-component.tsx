import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import katex from "katex";
import { useEffect, useRef } from "react";

export const MathInlineComponent: React.FC<NodeViewProps> = ({ node }) => {
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const expr = String(node.attrs.latex ?? "");
    if (containerRef.current) {
      try {
        katex.render(expr, containerRef.current, {
          throwOnError: false,
        });
      } catch (err) {
        console.error("KaTeX render error:", err, expr);
        containerRef.current.textContent = expr;
      }
    }
  }, [node.attrs.latex]);

  return (
    <NodeViewWrapper as="span" data-math-inline>
      <span ref={containerRef} style={{ fontSize: "12pt" }} />
    </NodeViewWrapper>
  );
};
