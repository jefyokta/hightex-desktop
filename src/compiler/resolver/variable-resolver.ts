import { VariableCase } from "@/editor/extensions/variable";
import { Engine } from "../engine";
import { Resolver } from "./resolver";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { applyCase } from "@/utils/apply-var-case";
import { parseItalic } from "@/utils/parse-italic";

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
      const texts =parseItalic(finalValue).map(t=>{
        if (t.type !=='italic') {   
          const text = document.createElement("text")
          text.textContent = t.text
          return text
        }
        const text = document.createElement('em')
        text.textContent = t.text
        return text
      })
      span.classList.add(`var-${mode}`)
      span.append(...texts);
    }
  }
}
