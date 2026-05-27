import { Engine } from "../engine";

export class DomPreprocessor {
  async resolve(engine: Engine) {
    const root = engine.root;

    root.querySelectorAll("img").forEach((img) => {
      const spacer = document.createElement("div");
      spacer.classList.add("spacer");
      img.parentElement?.append(spacer);
      const el = img as HTMLElement;
      el.style.maxWidth = "100%";
      el.style.height = "auto";
    });
  }
}
