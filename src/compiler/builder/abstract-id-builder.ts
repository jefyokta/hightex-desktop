import { StaticChapterBuilder } from "./static-chapter-builder";

export class AbstractIDBuilder extends StaticChapterBuilder {
  protected selector: string = ".abstract-id";
  protected chapterId: string = "abstract";
}
