import katex from "katex";
import { forwardRef, type HTMLAttributes } from "react";
import { MathBlockLayout, mathBlockControlClass } from "./math-block-layout";

/** One parser policy and error presentation for editable and captured math. */
export function mathPresentation(latex: string, displayMode: boolean) {
  const options = { displayMode, trust: false, maxExpand: 1000, maxSize: 10 };
  try {
    return {
      html: katex.renderToString(latex || "\\;", {
        ...options,
        throwOnError: true,
      }),
      invalid: false,
    };
  } catch (error) {
    if (!(error instanceof katex.ParseError)) throw error;
    return {
      html: katex.renderToString(latex || "\\;", {
        ...options,
        throwOnError: false,
      }),
      invalid: true,
    };
  }
}

export function MathInlinePresentation({ html }: { html: string }) {
  return (
    <span
      style={{ fontSize: "12pt" }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export const MathBlockPresentation = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & {
    html: string;
    number?: number | null;
  }
>(({ html, number, className, ...attributes }, ref) => (
  <div
    ref={ref}
    {...attributes}
    className={`flex justify-center ${className ?? ""}`}
  >
    <div className={mathBlockControlClass}>
      <MathBlockLayout html={html} number={number} />
    </div>
  </div>
));
