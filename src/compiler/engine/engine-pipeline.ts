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
import { CodeBlockResolver } from "../resolver/code-block-resolver";
import { VariableResolver } from "../resolver/variable-resolver";
import { HighTexDB } from "@/editor/storage/hightex-db";

export class EnginePipeline {
  private engine: Engine;

  private steps: Resolver[] = [
    new ParserResolver(),
    new StaticChapterResolver(),
    new CodeBlockResolver(),
    new KatexResolver(),
    new HeadingResolver(),
    new CaptionResolver(),
    new CitationResolver(),
    new LinkResolver(),
    new VariableResolver(),
    new ImageResolver(),
    new DomPreprocessor(),
    new TreeResolver(),
  ];

  constructor(engine: Engine) {
    this.engine = engine;
  }

  async run() {
    await HighTexDB.getInstance().warm()
    for (const step of this.steps) {
      await step.resolve(this.engine);
    }
  }
}
