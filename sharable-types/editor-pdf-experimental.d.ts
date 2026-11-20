export {};

declare global {
  type EditorPDFRect = [
    left: number,
    top: number,
    width: number,
    height: number,
  ];
  interface EditorPDFSection {
    id: string;
    firstPage: number;
    pages: number;
    labels: string[];
  }
  interface EditorPDFContent {
    documentId: string;
    sourceHash: string;
    planHash: string;
    pages: number;
    title: string;
    author: string;
    html: string;
    presentation: EditorPDFRect[][];
    fingerprint: string;
  }
  interface EditorPDFSnapshot extends EditorPDFContent {
    version: 3;
    sections: EditorPDFSection[];
    projection: EditorPDFProjection;
  }
  interface EditorPDFProjection {
    contexts: { pages: number; width: number; height: number; stride: number }[];
    views: { context: number; page: number }[];
    targets: { id: string; page: number; x: number; y: number }[];
    links: { target: string; page: number; x: number; y: number; width: number; height: number }[];
  }
  interface EditorPDFExperimentalAPI {
    debug(snapshot: EditorPDFSnapshot, requestId: string): Promise<void>;
    export(
      snapshot: EditorPDFSnapshot,
      requestId: string,
    ): Promise<{ path: string; filename: string } | null>;
    cancel(requestId: string): Promise<void>;
    init(request: string): Promise<EditorPDFSnapshot>;
    ready(request: string, fingerprint: string, pages: number): void;
    error(request: string, message: string): void;
  }
  interface Window {
    editorPDFExperimental: EditorPDFExperimentalAPI;
    editorPDFViewport?: { select(index: number, fingerprint: string, count?: number): void };
  }
}
