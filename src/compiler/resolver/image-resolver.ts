import { Engine } from "../engine";
import { Resolver } from "./resolver";

export class ImageResolver implements Resolver {
  async resolve(engine: Engine) {
    const root = engine.root;

    root.querySelectorAll("img").forEach((img) => {
      const el = img as HTMLElement;
      el.style.breakInside = "avoid";
      el.style.pageBreakInside = "avoid";
      el.style.maxWidth = "100%";
      el.style.height = "auto";
    });
  }
}
