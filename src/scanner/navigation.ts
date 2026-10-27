import type { Editor } from "@tiptap/core";
import type { Node } from "@tiptap/pm/model";
import { resolveDiagnosticTarget, type ScanDiagnostic } from "@hightex/scanner";

export const SCANNER_DIAGNOSTIC_PREFIX = "scanner:diagnostic:";

export function encodeScannerDiagnostic(diagnostic: ScanDiagnostic): string {
  return SCANNER_DIAGNOSTIC_PREFIX + JSON.stringify(diagnostic);
}

export function decodeScannerDiagnostic(
  value: string,
): ScanDiagnostic | undefined {
  if (!value.startsWith(SCANNER_DIAGNOSTIC_PREFIX)) return;
  try {
    const diagnostic: unknown = JSON.parse(
      value.slice(SCANNER_DIAGNOSTIC_PREFIX.length),
    );
    if (!diagnostic || typeof diagnostic !== "object") return;
    const item = diagnostic as Record<string, unknown>;
    if (
      typeof item.pluginId !== "string" ||
      typeof item.code !== "string" ||
      typeof item.message !== "string" ||
      typeof item.chapterId !== "string" ||
      !["warning", "error"].includes(String(item.severity))
    )
      return;
    if (
      item.nodeId !== undefined &&
      (typeof item.nodeId !== "string" || !item.nodeId)
    )
      return;
    if (
      item.path !== undefined &&
      (!Array.isArray(item.path) ||
        item.path.some((index) => !Number.isInteger(index) || index < 0))
    )
      return;
    if (item.range !== undefined) {
      if (
        !item.range ||
        typeof item.range !== "object" ||
        Array.isArray(item.range)
      )
        return;
      const range = item.range as Record<string, unknown>;
      if (
        typeof range.from !== "number" ||
        typeof range.to !== "number" ||
        !Number.isInteger(range.from) ||
        !Number.isInteger(range.to) ||
        range.from < 0 ||
        range.to < range.from
      )
        return;
    }
    return diagnostic as ScanDiagnostic;
  } catch {
    return;
  }
}

export function scannerChapterRoute(
  chapterId: string | undefined,
  documentId: string | undefined,
): string | undefined {
  if (!chapterId || !documentId) return;
  const [id, chapter, version, extra] = chapterId.split(".");
  if (id !== documentId || !chapter || extra !== undefined) return;
  return `/document/${encodeURIComponent(id)}/${encodeURIComponent(chapter)}${version ? `/${encodeURIComponent(version)}` : ""}`;
}

export function diagnosticLocationKey(
  diagnostic: Pick<ScanDiagnostic, "pluginId" | "chapterId" | "path" | "range">,
): string {
  return JSON.stringify([
    diagnostic.pluginId,
    diagnostic.chapterId,
    diagnostic.path,
    diagnostic.range?.from,
    diagnostic.range?.to,
  ]);
}

/** Resolve against the current editor tree, never a stored absolute position. */
export function focusScannerDiagnostic(
  editor: Editor,
  diagnostic: ScanDiagnostic,
): boolean {
  if (editor.isDestroyed) return false;
  const target = resolveDiagnosticTarget(editor.state.doc, diagnostic);
  if (!target) return false;
  const chain = editor.chain().focus();
  if (diagnostic.range || target.nodeType === "text") {
    chain.setTextSelection({ from: target.from, to: target.to });
  } else {
    chain.setNodeSelection(target.from);
  }
  return chain.scrollIntoView().run();
}

export const SCANNER_PARAGRAPH_PREFIX = "scanner:paragraph:";

/** Match the punctuation plugin's one-based paragraph order, including empty ones. */
export function findPunctuationParagraph(
  doc: Node,
  paragraph: number,
): number | undefined {
  if (!Number.isInteger(paragraph) || paragraph < 1) return;

  let count = 0;
  let position: number | undefined;
  doc.descendants((node, pos) => {
    if (position !== undefined || node.type.name === "codeBlock") return false;
    if (node.type.name === "paragraph") {
      if (++count === paragraph) position = pos + 1;
      return false;
    }
  });
  return position;
}

export function scrollToPunctuationParagraph(
  editor: Editor,
  paragraph: number,
): void {
  if (editor.isDestroyed) return;
  const position = findPunctuationParagraph(editor.state.doc, paragraph);
  if (position !== undefined) editor.commands.focus(position);
}
