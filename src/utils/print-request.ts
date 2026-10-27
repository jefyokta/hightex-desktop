import { ApplicationError } from "@/exception/interfaces/application-error";

export function printChannel(event: "payload" | "error", documentId: string) {
  const request = new URLSearchParams(window.location.search).get(
    "printRequest",
  );
  return `page:${event}:${documentId}${request ? `:${request}` : ""}`;
}

export function reportPrintError(documentId: string, error: unknown) {
  window.ipcRenderer?.send(
    printChannel("error", documentId),
    ApplicationError.normilize(error),
  );
}
