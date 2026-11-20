import type { Ref } from "react";

export const mathBlockControlClass = "rounded-md p-2 inline-block";

/** The visible equation and number are identical in live and snapshot views. */
export function MathBlockLayout({
  mathRef,
  html,
  number,
}: {
  mathRef?: Ref<HTMLDivElement>;
  html?: string;
  number?: number | null;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        ref={mathRef}
        className="pointer-events-none select-none"
        dangerouslySetInnerHTML={
          html === undefined ? undefined : { __html: html }
        }
      />
      {number !== null && number !== undefined && (
        <span
          className="text-sm text-neutral-500"
          data-equation-number={number}
        >
          ({number})
        </span>
      )}
    </div>
  );
}
