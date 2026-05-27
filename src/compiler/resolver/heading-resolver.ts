import { Engine } from "../engine";
import { Resolver } from "./resolver";

export class HeadingResolver implements Resolver {
  async resolve(engine: Engine): Promise<void> {
    const ctx = engine.config.parser;
    const headings = Array.from(
      engine.root.querySelectorAll<HTMLHeadingElement>(
        ".content h1,.content h2,.content h3",
      ),
    );

    const counters = {
      1: 0,
      2: 0,
      3: 0,
    };

    if (ctx.mode === "single") {
      counters[1] = ctx.chapter.getNumber()!;
    }

    for (const heading of headings) {
      const level = Number(heading.nodeName.slice(1)) as keyof typeof counters;
      // if (level == 1) {
      //   heading.style.setProperty("page-break-before", "always");
      // }

      counters[level]++;

      for (let i = level + 1; i <= 6; i++) {
        counters[i as keyof typeof counters] = 0;
      }

      heading.style.setProperty("--h1-counter", String(counters[1]));
      heading.style.setProperty("--h2-counter", String(counters[2]));
      heading.style.setProperty("--h3-counter", String(counters[3]));

      const numbering = [];

      for (let i = 1; i <= level; i++) {
        if (counters[i as keyof typeof counters] > 0) {
          numbering.push(counters[i as keyof typeof counters]);
        }
      }

      let num = numbering.join(".");
      if (num.includes(".")) {
        num = num.concat(". ");
      }

      heading.setAttribute("data-numbering", num);
    }
  }
}
