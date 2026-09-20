import { TOABuilder } from "../builder/toa-builder";
import { TocBuilder } from "../builder/toc-builder";
import { TOFBuilder } from "../builder/tof-builder";
import { Engine } from "../engine";
import { Resolver } from "./resolver";

export class TreeResolver implements Resolver {
  async resolve(engine: Engine): Promise<any> {
    return new Promise(async (res) => {
      if (engine.config.parser.mode == "single") {
        res(1);
        return;
      }
      const parent = engine.root.parentElement!;
      const { figures, tables } = new TOFBuilder().create();
      const toa = await (new TOABuilder().create(engine))

      parent.insertBefore(tables, engine.root);
      parent.insertBefore(figures, engine.root);
      parent.insertBefore(toa,engine.root)
      const toc = TocBuilder.create(engine);
      parent.insertBefore(toc, tables);
      res(1);
    });
  }
}
