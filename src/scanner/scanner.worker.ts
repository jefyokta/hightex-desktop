import { scan } from "./scan";
import { plugins, type ScanEvent } from "./plugins";
import type { ScanContext } from "./context";

const worker = self as unknown as DedicatedWorkerGlobalScope;
const send = (event: ScanEvent) => worker.postMessage(event);

worker.onmessage = async ({ data }: MessageEvent<ScanContext>) => {
  try {
    for await (const event of scan(plugins, data)) send(event);
  } catch (e) {
    send({ type: "error", id: "*", message: String(e) });
    send({ type: "done" });
  }
};
