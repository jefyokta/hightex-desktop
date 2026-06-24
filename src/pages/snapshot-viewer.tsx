import { ShouldNavigated } from "@/exception/interfaces/should-navigated";
import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { strFromU8, unzipSync } from "fflate";

export const SnapshotViewer = () => {
  const { id } = useParams();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const blobUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!id) {
      throw new ShouldNavigated("Snapshot not found", "/dashboard/snapshots");
    }
    blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    blobUrlsRef.current = [];

    window.ipcRenderer
      .invoke("snapshot:view", id)
      .then((r: ArrayBuffer) => {
        const lists = unzipSync(new Uint8Array(r));

        const html = strFromU8(lists["document.html"]);
        delete lists["document.html"];

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        doc.body.style.background = 'white'

  
        if (lists["style.css"]) {
          const css = strFromU8(lists["style.css"]) + ".pagedjs_page{ border:.5px solid black}";
          delete lists["style.css"];

          const style = doc.createElement("style");
          style.innerHTML = css;
          doc.head.appendChild(style);
        }

        const imageMap = Object.fromEntries(
          Object.entries(lists).map(([key, val]) => {
            const id = key.slice(7, key.length - 5);

            const blob = new Blob([new Uint8Array(val)]);
            const url = URL.createObjectURL(blob);
            blobUrlsRef.current.push(url);

            return [id, url];
          })
        );

        doc.querySelectorAll("img[data-img-id]").forEach((img) => {
          const id = img.getAttribute("data-img-id");
          if (!id) return;

          const url = imageMap[id];
          if (url) {
            (img as HTMLImageElement).src = url;
          }
        });


        if (iframeRef.current) {
          iframeRef.current.srcdoc = doc.documentElement.outerHTML;
        }
      })
      .catch((err) => {
        console.log(err);
        throw new ShouldNavigated(
          "Snapshot not found",
          "/dashboard/snapshots"
        );
      });


    return () => {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrlsRef.current = [];
    };
  }, [id]);

  return (
    <iframe
      ref={iframeRef}
      style={{ width: "100%", height: "100%", border: "none" }}
    />
  );
};