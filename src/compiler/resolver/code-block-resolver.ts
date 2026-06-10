import { createLowlight, common } from "lowlight";
import { Engine } from "../engine";
import { Resolver } from "./resolver";
import { toHtml } from "hast-util-to-html";

export class CodeBlockResolver implements Resolver {
  private lowlight: ReturnType<typeof createLowlight>;
  constructor() {
    this.lowlight = createLowlight(common);
  }

  async resolve(engine: Engine): Promise<any> {
    const parent = engine.root;
    if (!parent) return;

    const nodes = Array.from(
      parent.querySelectorAll("pre code"),
    ) as HTMLElement[];

    for (const c of nodes) {
      const text = c.getAttribute("code") || "";
      const lang = c.getAttribute("language") || "plaintext";

      try {
        const tree = this.lowlight.highlight(lang, text);

        c.innerHTML = toHtml(tree);
      } catch (error) {
        console.warn(`Failed to highlight language "${lang}":`, error);
      }
    }
  }
}
