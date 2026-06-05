import { StaticChapterBuilder } from "./static-chapter-builder";

export class AbstractENBuilder extends StaticChapterBuilder {
  protected chapterId: string = "abstract-en";
  protected selector: string = ".abstract-en";
}
