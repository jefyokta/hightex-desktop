import { punctuation } from "./punctuation";
import { unreferencedFigures } from "./unreferenced-figures";

export const plugins = [unreferencedFigures, punctuation];

type AnyPlugin = (typeof plugins)[number];

export type ScanResults = {
  [P in AnyPlugin as P["id"]]: Awaited<ReturnType<P["run"]>>;
};

type PluginId = keyof ScanResults;

export type ScanEvent =
  | { type: "progress"; id: PluginId; label: string }
  | {
      [K in PluginId]: { type: "result"; id: K; data: ScanResults[K] };
    }[PluginId]
  | { type: "error"; id: string; message: string }
  | { type: "done" };
