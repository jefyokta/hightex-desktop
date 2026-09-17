import React, { useEffect, useRef } from "react";
import katex from "katex";


export const Katex: React.FC<{ latex?: string }> = ({ latex }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !latex) {
      return;
    }

    katex.render(latex, ref.current, {
      throwOnError: false,
      displayMode: true,
    });
  }, []);

  return <div ref={ref} />;
};