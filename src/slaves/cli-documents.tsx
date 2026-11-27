import { useIPC } from "@/hooks/use-ipc";
import { useEffect } from "react";
import { HighTexDB } from "@/editor/storage/hightex-db";

export const CliDocumentsSlave = () => {
  useEffect(() => {
    const ipc = useIPC("ipcRenderer").ipcRenderer;
    const listener = async (_event: unknown, requestId: string) => {
      try {
        const documents = await HighTexDB.getMainDocuments();

        ipc.send(`cli:documents:response:${requestId}`, {
          documents: documents.map(({ id, title, updatedAt }) => ({
            id,
            title,
            updatedAt,
          })),
        });
      } catch (error) {
        ipc.send(`cli:documents:response:${requestId}`, {
          error:
            error instanceof Error
              ? error.message
              : "Failed to read documents.",
        });
      }
    };

    ipc?.on("cli:documents:request", listener);

    return () => {
      ipc?.off("cli:documents:request", listener);
    };
  }, []);

  return null;
};
