import { Outlet } from "react-router-dom";
import { useEffect } from "react";
import css from "@/css/document.css?raw";
import tocCss from "@/css/toc.css?raw";
import { PrintableProvider } from "@/hooks/use-printable";

export const PrintLayout = () => {
  useEffect(() => {
    document.body.dataset.mode = "print";

    document.querySelectorAll("style").forEach((el) => el.remove());
    document
      .querySelectorAll('link[rel="stylesheet"]')
      .forEach((el) => el.remove());
    const style = document.createElement("style");
    style.innerHTML = css + tocCss;
    document.head.append(style);
  }, []);

  return (
    <PrintableProvider>
      <Outlet />
    </PrintableProvider>
  );
};
