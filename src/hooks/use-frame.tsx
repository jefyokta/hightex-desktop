import { createCommentClass } from "@/utils/custom-element/comment";
import {
  useEffect,
  useRef,
  useState,
  useCallback,
  createContext,
  useContext,
} from "react";
import { createPortal } from "react-dom";

type MessageHandler = (payload: unknown) => void;

type FrameContextValue = {
  doc: Document | null;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  setHtml: (html: string) => Promise<void>;
};

export const FrameContext = createContext<FrameContextValue>({
  doc: null,
  iframeRef: { current: null },
  setHtml: async () => {},
});

export const useFrameContext = () => useContext(FrameContext);

export const useFrame = () => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const handlersRef = useRef<Map<string, MessageHandler>>(new Map());
  const [frameDoc, setFrameDoc] = useState<Document | null>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const init = () => setFrameDoc(iframe.contentDocument);

    if (iframe.contentDocument?.readyState === "complete") {
      init();
    } else {
      iframe.addEventListener("load", init);
      return () => iframe.removeEventListener("load", init);
    }
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const { type, payload } = event.data ?? {};
      handlersRef.current.get(type)?.(payload);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!frameDoc) return;

    const win = frameDoc.defaultView;
    if (!win) return;

    if (!win.customElements.get("ht-comment")) {
      const Comment = createCommentClass(frameDoc);

      win.customElements.define("ht-comment", Comment);
    }
  }, [frameDoc]);

  const send = useCallback((type: string, payload?: unknown) => {
    iframeRef.current?.contentWindow?.postMessage({ type, payload }, "*");
  }, []);

  const on = useCallback((type: string, handler: MessageHandler) => {
    handlersRef.current.set(type, handler);
    return () => handlersRef.current.delete(type);
  }, []);

  const setHtml = useCallback(async (html: string) => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    await new Promise<void>((resolve) => {
      iframe.addEventListener("load", () => resolve(), { once: true });
      const doc = iframe.contentDocument!;
      if (doc === window.document) {
        console.error("setHtml: contentDocument adalah document parent!");
        return;
      }

      doc.open();
      doc.write(html);
      doc.close();
    });

    setFrameDoc(iframe.contentDocument);
  }, []);

  const FramePortal = useCallback(
    ({ children }: { children: React.ReactNode }) =>
      frameDoc ? createPortal(children, frameDoc.body) : null,
    [frameDoc],
  );

  return { iframeRef, frameDoc, setHtml, send, on, FramePortal };
};
