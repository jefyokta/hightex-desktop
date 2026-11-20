import { StylesheetSnapshot } from "./stylesheet-snapshot";
import type { DocumentResourceContext } from "./contracts";
import { toBase64 } from "@/utils/is-base-64";
import { waitForPrintImages } from "@/compiler/print-resources";
import { waitForContentFonts } from "./fonts";

/** Resolve CSS/image/font bytes once for a portable, independently owned snapshot. */
export class DocumentResources implements DocumentResourceContext {
  private readonly resources = new Map<string, Promise<string>>();
  private readonly presentation: StylesheetSnapshot;
  constructor(private readonly signal: AbortSignal) {
    this.presentation = new StylesheetSnapshot(this, signal);
  }

  styles() { return this.presentation.styles(); }
  assertCurrent() { this.presentation.assertCurrent(); }
  layoutFingerprint() { return this.presentation.layoutFingerprint(); }

  /** Embed assets before reading presentation or link coordinates from this copy. */
  async prepare(root: HTMLElement) {
    for (const image of root.querySelectorAll("img"))
      image.src = await this.data(image.src);
    await waitForPrintImages(root, this.signal);
    await waitForContentFonts(root, this.signal);
  }

  data(url: string, base = document.baseURI): Promise<string> {
    if (url.startsWith("data:") || url.startsWith("#"))
      return Promise.resolve(url);
    const absolute = new URL(url, base).href;
    let captured = this.resources.get(absolute);
    if (!captured) {
      captured = (async () => {
        this.signal.throwIfAborted();
        const response = await fetch(absolute, { signal: this.signal });
        if (!response.ok)
          throw Error(
            `Unable to capture editor PDF resource ${absolute}: HTTP ${response.status} ${response.statusText}`,
          );
        const blob = await response.blob();
        const result = await toBase64(
          new File([blob], "asset", { type: blob.type }),
        );
        this.signal.throwIfAborted();
        return result;
      })();
      this.resources.set(absolute, captured);
    }
    return captured;
  }
}
