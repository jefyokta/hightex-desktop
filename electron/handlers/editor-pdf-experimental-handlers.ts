import { IPCMain } from "../utilities/ipc-main";
import { EditorPDFExperimentalService } from "../service/editor-pdf-experimental-service";
import { ShouldReport } from "../exception/should-report";
import { Handled } from "../exception/interface/handled";

export class EditorPDFExperimentalHandlers {
  static register() {
    const jobs = new Map<string, AbortController>();
    for (const action of ["export", "debug"] as const) 
   {  
    IPCMain.handle(`experimental:editor-pdf:${action}`,
async (event, input: EditorPDFSnapshot, requestId: string) => {
        if (
          event.senderFrame?.processId !== event.sender.mainFrame.processId ||
          event.senderFrame?.routingId !== event.sender.mainFrame.routingId
        )
          throw Error("forbidden");
        if ( typeof requestId !== "string" || !/^[a-zA-Z0-9-]{1,128}$/.test(requestId) ) throw Error("Invalid editor PDF request");
        const key = `${event.sender.id}:${requestId}`;
        if (jobs.has(key)) throw Error("Editor PDF request already running");
        const task = new AbortController();
        jobs.set(key, task);
        const closed = () => task.abort();
        event.sender.once("destroyed", closed);
        try {
          return await new EditorPDFExperimentalService()[action](
            input,
            task.signal,
          );
        } catch (error) {
          if (task.signal.aborted || error instanceof Handled) throw error;
          throw new ShouldReport(error instanceof Error ? error.message : String(error), { cause: error });
        } finally {
          jobs.delete(key);
          if (!event.sender.isDestroyed())
            event.sender.removeListener("destroyed", closed);
        }
      },
    );
  }
    IPCMain.handle(
      "experimental:editor-pdf:cancel",
      (event, requestId: string) => {
        jobs.get(`${event.sender.id}:${requestId}`)?.abort();
      },
    );
  }
}
