import { forwardRef, type HTMLAttributes } from "react";
import { ParsedItalic } from "@/utils/parse-italic";
import { applyCase } from "@/utils/apply-var-case";
import type { VariableCase } from ".";

export const VariablePresentation = forwardRef<
  HTMLSpanElement,
  HTMLAttributes<HTMLSpanElement> & {
    value: string;
    mode: VariableCase;
  }
>(({ value, mode, className, ...attributes }, ref) => (
  <span
    ref={ref}
    {...attributes}
    className={`var-${mode}${className ? ` ${className}` : ""}`}
  >
    <ParsedItalic text={applyCase(value, mode)} />
  </span>
));
