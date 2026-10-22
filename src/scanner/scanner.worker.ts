import {
  scan,
  plugins,
  type DefaultScanEvent as ScanEvent,
  type ScanContext,
} from "@hightex/scanner";

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
