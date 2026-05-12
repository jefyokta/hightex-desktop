import { ApplicationError } from "../../exception/application-error";
import { events } from "../event";
import { HighTexDB } from "../storage/hightex-db";

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

    window.addEventListener("error", onError);

    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);

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

  static async deleteDocument(documentId: string, version?: string) {
    const db = HighTexDB.getInstance();

    const prefix = `${documentId}.`;

    if (!version) {
      await db.documents.delete(documentId);

      const keys = await db.chapters
        .where("id")
        .between(prefix, prefix + "\uffff")
        .primaryKeys();

      await db.chapters.bulkDelete(keys as string[]);

      return;
    }

    const keys = await db.chapters
      .where("id")
      .between(prefix, prefix + "\uffff")
      .filter((chapter) => {
        return chapter.id.endsWith(`.${version}`);
      })
      .primaryKeys();

    await db.chapters.bulkDelete(keys as string[]);
  }
}
