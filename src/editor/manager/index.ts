import { MainProcessError } from "@/exception/interfaces/main-process-error";
import { ApplicationError } from "../../exception/interfaces/application-error";
import { events } from "../event";
import { HighTexDB } from "../storage/hightex-db";
import { Confirm } from "@/decorators/confirm";
import { truncate } from "@/utils/truncate";

import { ExportTimeout } from "@/exception/export-time-out";
import { progressiveToast } from "@/utils/progressive-toast";

type ErrorPayload = {
  error: unknown;
  name: string;
};

class App {
  dispatch<K extends keyof AppEvents>(eventName: K, payload: AppEvents[K]) {
    window.dispatchEvent(
      new CustomEvent(eventName, {
        detail: payload,
        bubbles: true,
        composed: true,
      }),
    );
  }

  on<K extends keyof AppEvents>(
    eventName: K,
    callback: (payload: AppEvents[K]) => any,
  ) {
    const listener = (e: Event) => {
      const ce = e as CustomEvent<AppEvents[K]>;

      callback(ce.detail);
    };

    window.addEventListener(eventName, listener);

    return () => {
      window.removeEventListener(eventName, listener);
    };
  }

  onError(callback: (payload: ErrorPayload) => void) {
    const normalize = (err: unknown): ErrorPayload => {
      if (err instanceof ApplicationError) {
        return {
          error: err,
          name: err.name,
        };
      }

      return {
        error: err,
        name: typeof err,
      };
    };
    const onMainError = (_: any, e: any) => {
      if("name" in e && e.name === 'export-timeout'){
        callback({
          error: new ExportTimeout(e.error.desc,e.error.logFile)
          ,
          name:e.name
        })

        return
      }
            callback(normalize(new MainProcessError(e)));
    };
    const onError = (event: ErrorEvent) => {
      if (event.error instanceof ApplicationError) {
        event.preventDefault();
      }

      callback(normalize(event.error));
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason instanceof ApplicationError) {
        event.preventDefault();
      }

      callback(normalize(event.reason));
    };
    if ("ipcRenderer" in window) {
      window.ipcRenderer.on("error", onMainError);
    }

    window.addEventListener("error", onError);

    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      if ("ipcRenderer" in window) {
        window.ipcRenderer.off("error", onMainError);
      }

      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }
}

export class Manager {
  static readonly app = new App();

  static emit<K extends keyof typeof events>(
    event: K,
    ...args: Parameters<(typeof events)[K]>
  ) {
    const fn = events[event] as (...args: any[]) => any;

    return fn(...args);
  }

  @Confirm(async (docId,_)=>({
    title:"Are you sure?",
    desc:`Document \`${truncate(await HighTexDB.getInstance().documents.get(docId).then(d=>d?.title || "unknown doc"),20)}\` will be deleted`
  }))
  static async deleteDocument(documentId: string, _version?: string) {
    const db = HighTexDB.getInstance();
   return await db.deleteDocument(documentId);
  }
  @Confirm(async (...docs) => ({
    title: "Are you sure?",
    desc: `${docs.length} documents will be deleted`,
  }))
  static async deleteDocuments(...documentIds: string[]) {
    const total = documentIds.length;
    const pt = progressiveToast({ initialStatus: "Deleting documents...", initialProgress: 0 });
    const deleted:string[] = []

    try {
      for (let i = 0; i < total; i++) {
        const id = documentIds[i];

        await HighTexDB.getInstance().deleteDocument(id);

        pt.update(
          `Deleting ${i + 1} of ${total}...`,
          Math.round(((i + 1) / total) * 100),
        );
        deleted.push(id)

      }

      pt.success({
        title: `${total} document${total > 1 ? "s" : ""} deleted`,
      });
    } catch (e) {
      pt.error({ title: "Failed to delete documents", error: e });
    } finally {
      this.app.dispatch("documents:deleted",{documentIds:deleted})
    }
  }
  static element() {
    const el = document.getElementById("page");
    return el;
  }

  static scrollTo(id: string) {
    const parent = document.getElementById("main-scroll");
    const el = document.getElementById(id);
    if (!el || !parent) {
      return;
    }

    const rect = el.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();

    parent.scrollTo({
      top: rect.top - parentRect.top + parent.scrollTop - 70,
      behavior: "smooth",
    });
  }
}
