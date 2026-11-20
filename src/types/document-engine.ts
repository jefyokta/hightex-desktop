import type { JSONContent } from "@tiptap/core";
import type {
  SectionCompositionDefinition,
  SectionSourceLocator,
} from "../../shared/section-layout";
import type { DocumentEngineError } from "@/exception/document-engine-error";
import type { PaginationImageIssue } from "@/types/pagination/image-issue";
import type { ChapterRenderIssue } from "./chapter-content";
import type {
  SectionOptions,
  SectionGroup,
} from "@/types/pagination/section-options";
export type {
  SectionOptions,
  SectionGroup,
} from "@/types/pagination/section-options";

export type EngineIssueLevel = "warning" | "fatal";
export type EngineIssueCode =
  | "link.invalid"
  | "reference.missing"
  | "reference.rendering"
  | "content.unresolved"
  | "pagination.table.repeat.compact"
  | PaginationImageIssue["code"]
  | "unexpected";
export interface DocumentEngineOptions {
  sections?: Partial<Record<SectionGroup, SectionOptions>>;
}
export interface SectionBase {
  id: string;
  title: string;
  numbering: "none" | "roman" | "arabic" | "appendix";
  group?: SectionGroup;
  options?: SectionOptions;
}
export interface EditorSection extends SectionBase {
  kind: "editor";
  chapter: string;
  className: string;
  nodes: JSONContent[];
  counter?: number;
  composition?: SectionCompositionDefinition;
}
export interface TemplateSection extends SectionBase {
  kind: "template";
  html: string;
  index?: "toc" | "tot" | "tof";
  issues?: readonly ChapterRenderIssue[];
}
export type DocumentSection = EditorSection | TemplateSection;
export interface DocumentPage {
  /** Provenance belongs to the canonical section, independent of the active editor. */
  sourceOf?: (node: Element) => SectionSourceLocator | undefined;
  element: HTMLElement;
  content: HTMLElement;
  /** Canonical context ownership for a bounded composite section. */
  projection?: {
    context: HTMLElement;
    page: number;
    pages: number;
    geometry: { width: number; height: number; stride: number };
  };
  targets?: readonly HTMLElement[];
  links?: readonly HTMLAnchorElement[];
}
export interface SectionOutline {
  id: string;
  text: string;
  /** Resolved inline title content, without source IDs, controls or link destinations. */
  titleHTML: string;
  group: SectionGroup;
  number: string;
  level: number;
  kind: "heading" | "imageFigure" | "figureTable";
}
export interface RenderedSection {
  pages: readonly DocumentPage[];
  outline: readonly SectionOutline[];
  identity: unknown;
  issues?: readonly ChapterRenderIssue[];
  destroy(): void;
}
export interface DocumentSectionSlot {
  definition: DocumentSection;
  rendered?: RenderedSection;
}
export interface RenderedDocumentSection extends DocumentSectionSlot {
  rendered: RenderedSection;
}
export interface DocumentRenderResult {
  pages: number;
  sections: readonly PageSection[];
  warnings: number;
}
/** Presentation can use reserved margins; it must not reflow content or choose page breaks. */
export type DocumentPageDecorator = (
  page: DocumentPage,
  context: {
    label: string;
    section: Readonly<DocumentSection>;
    signal: AbortSignal;
  },
) => void | Promise<void>;
export interface SectionRenderContext {
  runId: string;
  signal: AbortSignal;
}
export interface SectionRenderer<Section extends DocumentSection> {
  render(
    section: Section,
    context: SectionRenderContext,
  ): Promise<RenderedSection>;
  destroy?(): void;
}
export interface EngineRenderers {
  editor: SectionRenderer<EditorSection>;
  template: SectionRenderer<TemplateSection>;
}
export interface PageSection {
  id: string;
  firstPage: number;
  pages: number;
  labels: string[];
}
export interface EngineDiagnostic {
  runId: string;
  documentId: string;
  sectionId?: string;
  sectionTitle?: string;
  sectionKind?: DocumentSection["kind"];
  source?: SectionSourceLocator;
  stage:
    | "start"
    | "section"
    | "content"
    | "index"
    | "references"
    | "assembly"
    | "rendered";
}
type EngineEventContext = EngineDiagnostic & { sequence: number };
type EngineHookContext = EngineEventContext & { signal: AbortSignal };
export type EnginePhase = "content" | "index";
export type EngineNotification = "rendered" | "error" | "cancel" | "dispose";
export type EngineHook = Exclude<
  keyof DocumentEngineEvents,
  EngineNotification
>;
export interface DocumentEngineEvents {
  start: EngineHookContext & { sections: number };
  "section.before": EngineHookContext & {
    section: Readonly<DocumentSection>;
    phase: EnginePhase;
    pass: number;
  };
  "section.after": EngineHookContext & {
    pages: number;
    phase: EnginePhase;
    pass: number;
  };
  chapter: EngineHookContext & {
    chapterId: string;
    title: string;
    pages: number;
  };
  contentRendered: EngineHookContext & {
    sections: number;
    contentPages: number;
    outline: readonly SectionOutline[];
  };
  "index.pass": EngineHookContext & {
    pass: number;
    changed: readonly string[];
    stable: boolean;
  };
  rendered: EngineEventContext & DocumentRenderResult;
  diagnostic: EngineHookContext & { error: DocumentEngineError };
  error: EngineEventContext & { error: DocumentEngineError };
  cancel: EngineEventContext & { reason: unknown };
  dispose: {
    runId?: string;
    documentId?: string;
    sequence: number;
  };
}
