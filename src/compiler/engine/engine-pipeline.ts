import { Engine } from "./";
import { CitationResolver } from "../resolver/citation-resolver";
import { DomPreprocessor } from "../resolver/dom-prepocessor";
import { LinkResolver } from "../resolver/link-resolver";
import { ImageResolver } from "../resolver/image-resolver";
import { ParserResolver } from "../resolver/parser-resolver";
import { Resolver } from "../resolver/resolver";
import { HeadingResolver } from "../resolver/heading-resolver";
import { CaptionResolver } from "../resolver/caption-resolver";
import { TreeResolver } from "../resolver/tree-resolver";
import { KatexResolver } from "../resolver/katex-resolver";
import { StaticChapterResolver } from "../resolver/static-chapter-resolver";

export class EnginePipeline {
  private engine: Engine;

  private steps: Resolver[] = [
    new ParserResolver(),
    new StaticChapterResolver(),
    new KatexResolver(),
    new HeadingResolver(),
    new CaptionResolver(),
    new CitationResolver(),
    new LinkResolver(),
    new ImageResolver(),
    new DomPreprocessor(),
    new TreeResolver(),
  ];

  constructor(engine: Engine) {
    this.engine = engine;
  }

  async run() {
    for (const step of this.steps) {
      await step.resolve(this.engine);
    }
  }
}
