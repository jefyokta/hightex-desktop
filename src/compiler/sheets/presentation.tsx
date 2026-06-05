import { HTMLAttributes } from "react";

export const Presentation = ({ ...props }: HTMLAttributes<HTMLDivElement>) => {
  return (
    <section className="introduction page-break">
      <h1 className="pra-title chapter" id="presentation">
        LEMBAR PERSEMBAHAN
      </h1>
      <div
        {...props}
        className="presentation"
        style={{ lineHeight: "1.5" }}
      ></div>
    </section>
  );
};
