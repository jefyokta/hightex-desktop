import { StaticChapterBuilder } from "./static-chapter-builder";

export class PresentationBuilder extends StaticChapterBuilder{
    protected selector: string = '.presentation';
    protected chapterId: string = 'presentation';
}