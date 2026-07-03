import { VariableCase } from "@/editor/extensions/variable";
import { Engine } from "../engine";
import { Resolver } from "./resolver";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { applyCase } from "@/utils/apply-var-case";

export class VariableResolver implements Resolver {
  async resolve(engine: Engine): Promise<any> {
    const root = engine.root;
    const doc =
      engine.parser.mode == "single"
        ? engine.parser.chapter.document
        : engine.parser.document;
    if (!doc.ready) {
      await doc.warm();
    }
    const spans = Array.from(root.querySelectorAll("[data-variable]"));

    for (const span of spans) {
      const name = span.getAttribute("data-variable")!;
      const mode = (span.getAttribute("data-case") ||
        "preserve") as VariableCase;
      const value = (await HighTexDB.getInstance().getVar(name, doc.id)) || "";
      const finalValue = applyCase(value, mode);
      span.textContent = finalValue;
    }
  }
}
