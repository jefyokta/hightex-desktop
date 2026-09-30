import type { ScanContext } from "./context";
import type { Plugin } from "./plugins/types";
import type { ScanEvent } from "./plugins";

export async function* scan(
  plugins: readonly Plugin[],
  ctx: ScanContext,
): AsyncGenerator<ScanEvent> {
  for (const plugin of plugins) {
    yield { type: "progress", id: plugin.id, label: plugin.label } as ScanEvent;

    try {
      const data = await plugin.run(ctx);
      yield { type: "result", id: plugin.id, data } as ScanEvent;
    } catch (e) {
      yield {
        type: "error",
        id: plugin.id,
        message: e instanceof Error ? e.message : String(e),
      };
    }
  }

  yield { type: "done" };
}