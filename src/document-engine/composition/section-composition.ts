import type {
  SectionCompositionDefinition,
  SectionLayoutEffects,
} from "../../../shared/section-layout";
import { sameSectionComposition } from "../../../shared/section-layout";
import { clearPaginationPresentation } from "@/editor/pagination/presentation/decorations";
import { insertGeneratedSpacer } from "@/editor/pagination/flow/generated-flow";
import "@/css/section-composition.css";

/** A template shell owns generated content; the body slot owns one unchanged editor. */
export class SectionComposition {
  private static readonly mounted = new WeakMap<Element, SectionComposition>();
  static forEditor(root: Element): SectionComposition | undefined {
    const element = root.closest("[data-section-composition]");
    return element ? this.mounted.get(element) : undefined;
  }
  readonly element: HTMLElement;
  readonly body: HTMLElement;
  readonly blocks: ReadonlyMap<string, HTMLElement>;
  readonly definition: Readonly<SectionCompositionDefinition>;
  private lastEffects?: SectionLayoutEffects["generated"];

  constructor(
    ownerDocument: Document,
    definition: SectionCompositionDefinition,
  ) {
    this.definition = Object.freeze({
      html: definition.html,
      bodySelector: definition.bodySelector,
      headingAnchor: definition.headingAnchor,
    });
    const holder = ownerDocument.createElement("div");
    holder.innerHTML = definition.html;
    if (
      holder.children.length !== 1 ||
      !(holder.firstElementChild instanceof HTMLElement)
    )
      throw Error("Section composition requires one template root");
    this.element = holder.firstElementChild;
    const bodies = this.element.querySelectorAll<HTMLElement>(
      definition.bodySelector,
    );
    if (
      bodies.length !== 1 ||
      bodies[0].parentElement !== this.element ||
      bodies[0].childNodes.length
    )
      throw Error("Section composition requires one empty direct body slot");
    this.body = bodies[0];
    this.body.dataset.sectionCompositionBody = "";
    this.element.dataset.sectionComposition = "";
    this.element.classList.add("document-template-content");
    this.element.classList.remove("new-page");
    const blocks = new Map<string, HTMLElement>();
    const addBlock = (element: HTMLElement, slot: string) => {
      const children = Array.from(element.children);
      // Split ordinary template containers by their own text blocks. Mixed
      // inline/block content stays together so no generated text is discarded.
      const blockChildren =
        children.length &&
        children.every(
          (child) =>
            child instanceof HTMLElement &&
            /^(DIV|P|H[1-6]|SECTION|UL|OL|LI)$/.test(child.tagName),
        );
      const ownText = Array.from(element.childNodes).some(
        (node) => node instanceof Text && node.textContent?.trim(),
      );
      if (blockChildren && !ownText)
        children.forEach((child, index) =>
          addBlock(child as HTMLElement, `${slot}.${index}`),
        );
      else {
        element.dataset.sectionCompositionBlock = slot;
        blocks.set(slot, element);
      }
    };
    Array.from(this.element.children).forEach((child, index) => {
      if (child === this.body) return;
      if (!(child instanceof HTMLElement))
        throw Error("Unsupported generated composition element");
      addBlock(child, `template-${index}`);
    });
    this.blocks = blocks;
    SectionComposition.mounted.set(this.element, this);
  }

  apply(
    effects: SectionLayoutEffects,
    definition: SectionCompositionDefinition | null = this.definition,
  ) {
    const generated = sameSectionComposition(this.definition, definition)
      ? effects.generated
      : undefined;
    if (this.lastEffects === generated) return;
    const changes = (generated ?? []).map((effect) => {
      const element = this.blocks.get(effect.slot);
      if (!element) throw Error(`Unknown composition slot: ${effect.slot}`);
      return { element, effect };
    });
    for (const block of this.blocks.values()) {
      block
        .querySelectorAll("[data-editor-page-break]")
        .forEach((node) => node.remove());
      block.normalize();
      clearPaginationPresentation(block);
    }
    for (const { element, effect } of changes) {
      if (effect.offset !== undefined) {
        insertGeneratedSpacer(element, effect.offset, effect.height);
        continue;
      }
      element.classList.add("editor-pagination-block");
      element.style.setProperty("--editor-break-height", `${effect.height}px`);
      element.style.setProperty(
        "--editor-original-margin",
        `${effect.marginTop}px`,
      );
    }
    this.lastEffects = generated;
  }
}
