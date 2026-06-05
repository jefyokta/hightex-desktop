import { StaticChapterBuilder } from "./static-chapter-builder";

export class ForewordBuilder extends StaticChapterBuilder {
  protected selector: string = ".foreword";
  protected chapterId: string = "foreword";
}
