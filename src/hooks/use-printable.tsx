import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { getStrictContext } from "@/lib/get-strict-context";
import { Document } from "@/editor/document";

type PrintablePageMode = "single" | "full" | null;

type PrintableContextType = {
  document: Document | null;
  profile: DocumentProfile | null;
  ready: boolean;
  pageMode: PrintablePageMode;
  inFrame: boolean;
};
const [PrintableContextProvider, usePrintable] =
  getStrictContext<PrintableContextType>("PrintableContext");

const getPrintableApi = () => {
  if (typeof window === "undefined") {
    return undefined;
  }

  if (window.hightex) {
    return window.hightex;
  }

  if (window.parent !== window) {
    const parentWindow = window.parent as Window & {
      hightex?: Window["hightex"];
    };
    return parentWindow.hightex;
  }

  return undefined;
};

const waitForPrintableApi = async () => {
  const api = getPrintableApi();
  if (api) {
    return api;
  }

  return new Promise<typeof window.hightex>((resolve, reject) => {
    const interval = window.setInterval(() => {
      const nextApi = getPrintableApi();
      if (nextApi) {
        window.clearInterval(interval);
        window.clearTimeout(timeout);
        resolve(nextApi);
      }
    }, 100);

    const timeout = window.setTimeout(() => {
      window.clearInterval(interval);
      reject(new Error("Printable API is not available"));
    }, 5000);
  });
};

export const PrintableProvider = ({
  children,
}: {
  children?: React.ReactNode;
}) => {
  const { id, chapterId } = useParams();
  const [document, setDocument] = useState<Document | null>(null);
  const [profile, setProfile] = useState<DocumentProfile | null>(null);
  const [ready, setReady] = useState(false);

  const pageMode: PrintablePageMode = id ? "full" : chapterId ? "single" : null;
  const inFrame = typeof window !== "undefined" && window.parent !== window;

  useEffect(() => {
    let mounted = true;

    if (!id) {
      setDocument(null);
      setProfile(null);
      setReady(false);
      return;
    }

    const loadDocument = async () => {
      try {
        await waitForPrintableApi();

        const nextDocument = new Document(id);
        await nextDocument.warm();

        if (!mounted) {
          return;
        }

        Document.instance = nextDocument;
        setDocument(nextDocument);
        setReady(true);
      } catch (error) {
        console.error("PrintableProvider failed to warm document:", error);
      }
    };

    loadDocument();

    return () => {
      mounted = false;
    };
  }, [id]);

  useEffect(() => {
    let mounted = true;

    if (pageMode !== "full" || !ready || !document) {
      setProfile(null);
      return;
    }

    const loadProfile = async () => {
      try {
        const api = await waitForPrintableApi();
        if (!mounted) return;

        const nextProfile = await api.profile();
        if (!mounted) return;

        setProfile(nextProfile);
      } catch (error) {
        console.error("PrintableProvider failed to load profile:", error);
      }
    };

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [document, pageMode, ready]);

  const value = useMemo(
    () => ({ document, profile, ready, pageMode, inFrame }),
    [document, profile, ready, pageMode, inFrame],
  );

  return (
    <PrintableContextProvider value={value}>
      {children}
    </PrintableContextProvider>
  );
};

export { usePrintable };
