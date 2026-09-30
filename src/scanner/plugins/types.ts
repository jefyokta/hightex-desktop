import type { ScanContext } from "../context";

export interface Plugin<Id extends string = string, Result = unknown> {
  id: Id;
  label: string;
  run(ctx: ScanContext): Promise<Result>;
}

export const definePlugin = <Id extends string, Result>(
  plugin: Plugin<Id, Result>,
) => plugin;
