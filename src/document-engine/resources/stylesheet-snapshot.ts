import { sha256Text } from "@/utils/sha256";
import { EditorPDFStateError } from "@/exception/editor-pdf-state-error";
import { t } from "@/utils/lang";
import type { DocumentAssetResolver, DocumentPresentation } from "./contracts";

/** Captured stylesheet revisions and serialization, owned by one resource lifecycle. */
export class StylesheetSnapshot implements DocumentPresentation {
  private sheets?: CSSStyleSheet[];
  private readonly revisions = new Map<CSSStyleSheet, string>();
  private captured = new Map<CSSStyleSheet, string>();
  private serializing?: Promise<string>;
  private serialized?: string;
  private fingerprint?: {
    appearance: string;
    captured: Map<CSSStyleSheet, string>;
    value: Promise<string>;
  };

  constructor(
    private readonly assets: DocumentAssetResolver,
    private readonly signal: AbortSignal,
  ) {}

  private async css(text: string, base: string) {
    const matches = Array.from(
      text.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/g),
    );
    const values = await Promise.all(
      matches.map((match) =>
        this.assets.data((match[1] ?? match[2] ?? match[3]).trim(), base),
      ),
    );
    for (let index = matches.length - 1; index >= 0; index--) {
      const match = matches[index];
      text =
        text.slice(0, match.index!) +
        `url("${values[index]}")` +
        text.slice(match.index! + match[0].length);
    }
    return text;
  }

  private async sheet(sheet: CSSStyleSheet): Promise<string> {
    this.signal.throwIfAborted();
    const revision = this.revision(sheet);
    this.revisions.set(sheet, revision);
    if (sheet.disabled) return "";
    const parts: string[] = [];
    for (const rule of Array.from(sheet.cssRules))
      if (rule instanceof CSSImportRule) {
        if (!rule.styleSheet)
          throw Error(
            `Editor PDF stylesheet is not ready: @import ${rule.href}`,
          );
        let css = await this.sheet(rule.styleSheet);
        if (rule.supportsText) css = `@supports (${rule.supportsText}){${css}}`;
        if (rule.layerName !== null) css = `@layer ${rule.layerName}{${css}}`;
        parts.push(css);
      } else
        parts.push(
          await this.css(rule.cssText, sheet.href ?? document.baseURI),
        );
    if (this.revision(sheet) !== revision)
      throw new EditorPDFStateError(
        t("editor.pagination.pdf_presentation_changed"),
      );
    const css = parts.join("\n");
    return sheet.media.mediaText
      ? `@media ${sheet.media.mediaText}{${css}}`
      : css;
  }

  private revision(sheet: CSSStyleSheet) {
    return JSON.stringify([
      sheet.disabled,
      sheet.media.mediaText,
      Array.from(sheet.cssRules, (rule) => rule.cssText),
    ]);
  }

  private stylesCurrent(current: CSSStyleSheet[]) {
    return this.sheets !== undefined &&
      current.length === this.sheets.length &&
      current.every((sheet, index) => sheet === this.sheets![index]) &&
      Array.from(this.revisions).every(
        ([sheet, revision]) => this.revision(sheet) === revision,
      );
  }

  assertCurrent() {
    this.signal.throwIfAborted();
    if (!this.stylesCurrent(Array.from(document.styleSheets)))
      throw new EditorPDFStateError(
        t("editor.pagination.pdf_presentation_changed"),
      );
  }

  async styles(): Promise<string> {
    // Fingerprinting and snapshot packaging share the same in-flight capture.
    if (this.serializing) return this.serializing;
    const work = this.captureStyles();
    this.serializing = work;
    try {
      return await work;
    } catch (error) {
      this.sheets = undefined;
      this.revisions.clear();
      this.captured.clear();
      this.fingerprint = undefined;
      this.serialized = undefined;
      throw error;
    } finally {
      this.serializing = undefined;
    }
  }

  private async captureStyles(): Promise<string> {
    this.signal.throwIfAborted();
    const sheets = Array.from(document.styleSheets);
    if (this.stylesCurrent(sheets)) return this.serialized!;
    this.sheets = sheets;
    this.serialized = undefined;
    this.fingerprint = undefined;
    this.revisions.clear();
    const result = await Promise.all(
      this.sheets.map((sheet) => this.sheet(sheet)),
    );
    this.assertCurrent();
    this.captured = new Map(
      this.sheets.map((sheet, index) => [sheet, result[index]]),
    );
    this.serialized = result.join("\n");
    return this.serialized;
  }

  async layoutFingerprint(): Promise<string> {
    await this.styles();
    const appearance = document.documentElement.className;
    if (this.fingerprint?.appearance === appearance &&
        this.fingerprint.captured === this.captured)
      return this.fingerprint.value;
    // Tiptap injects/removes equivalent base rules as views mount/unmount.
    // Pagination's persistent content CSS already owns these metrics.
    const css = this.sheets!.filter(
      (sheet) =>
        !(
          sheet.ownerNode instanceof Element &&
          sheet.ownerNode.hasAttribute("data-tiptap-style")
        ),
    ).map((sheet) => this.captured.get(sheet));
    const value = sha256Text(JSON.stringify([appearance, css]));
    this.fingerprint = { appearance, captured: this.captured, value };
    return value;
  }
}
