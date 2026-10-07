import EventEmitter from "node:events";

interface AppEvents {
    unauthorized: [params: UnauthorizedParams];
    "server-error": [params: ServerErrorParams];
}

interface UnauthorizedParams {
    reason: string;
}

interface ServerErrorParams {
    error: Error;
    status: number;
}

export class AppEvent extends EventEmitter<AppEvents> {}

export const appEvent = new AppEvent();