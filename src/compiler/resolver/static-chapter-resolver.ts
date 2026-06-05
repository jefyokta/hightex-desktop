import { AbstractENBuilder } from "../builder/abstract-en-builder";
import { AbstractIDBuilder } from "../builder/abstract-id-builder";
import { ForewordBuilder } from "../builder/foreword-builder";
import { PresentationBuilder } from "../builder/presentation-builder";
import { Engine } from "../engine";
import { Resolver } from "./resolver";

export class StaticChapterResolver implements Resolver {
  private builders = [
    new AbstractENBuilder(),
    new AbstractIDBuilder(),
    new ForewordBuilder(),
    new PresentationBuilder(),
  ];
  async resolve(engine: Engine) {
    if (engine.config.parser.mode == "single") {
      return;
    }
    for (const builder of this.builders) {
      await builder.build(engine.config.parser.document);
    }
  }
}
