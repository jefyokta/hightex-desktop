import { useEffect } from "react";
import { HighTexDB } from "@/editor/storage/hightex-db";

export const CliDocumentsSlave = () => {
  useEffect(() => {
    const listener = async (_event: unknown, requestId: string) => {
      try {
        const documents = await HighTexDB.getDocuments();

        window.ipcRenderer.send(`cli:documents:response:${requestId}`, {
          documents: documents.map(({ id, title, updatedAt }) => ({
            id,
            title,
            updatedAt,
          })),
        });
      } catch (error) {
        window.ipcRenderer.send(`cli:documents:response:${requestId}`, {
          error:
            error instanceof Error
              ? error.message
              : "Failed to read documents.",
        });
      }
    };

    window.ipcRenderer?.on("cli:documents:request", listener);

    return () => {
      window.ipcRenderer?.off("cli:documents:request", listener);
    };
  }, []);

  return null;
};
