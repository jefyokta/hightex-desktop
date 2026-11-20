import type {
  RenderedDocumentSection,
  EngineDiagnostic,
} from "@/types/document-engine";
import { contentAssets } from "@/utils/content-assets";
import { DocumentEngineError } from "@/exception/document-engine-error";
import { pageLinks } from "./page-content";
import { referenceFallback } from "./link-presentation";
import {
  documentLinkHref,
  documentLinkTarget,
} from "../../shared/document-link";

/** Preserve content and recover broken links; diagnostics distinguish input mistakes from renderer defects. */
export function* resolveDocumentReferences(
  sections: readonly RenderedDocumentSection[],
  targets: ReadonlyMap<string, string>,
  diagnostic: EngineDiagnostic,
) {
  const source = contentAssets(
    sections.flatMap(({ definition }) =>
      definition.kind === "editor"
        ? [{ id: definition.id, content: definition.nodes }]
        : [],
    ),
  ).anchors;
  const reported = new Set<string>();
  for (const { definition, rendered } of sections)
    for (const page of rendered.pages)
      for (const link of pageLinks(page)) {
        const href = link.getAttribute("href") ?? "";
        const normalized = documentLinkHref(href),
          id = documentLinkTarget(normalized);
        const authored = link.getAttribute("data-type") === "ref-component";
        const invalid = link.getAttribute("data-link-invalid");
        const missing =
          authored && link.getAttribute("data-status") === "missing";
        if (
          !missing &&
          invalid == null &&
          (id ? targets.has(id) : normalized !== "#" || href.trim() === "#")
        )
          continue;
        const target = link.getAttribute("data-link") || id || invalid || href;
        const system = !!id && source.has(id) && !missing;
        // A lost rendered anchor does not invalidate a number already resolved
        // from source. Keep measured text; only disable navigation after layout.
        if (authored && !system) referenceFallback(link);
        else link.setAttribute("href", "#");
        const key = `${definition.id}\0${authored}\0${target}`;
        if (reported.has(key)) continue;
        reported.add(key);
        yield new DocumentEngineError(
          {
            ...diagnostic,
            sectionId: definition.id,
            sectionTitle: definition.title,
            sectionKind: definition.kind,
            source:
              page.sourceOf?.(link) ??
              rendered.issues?.find(
                (issue) => issue.kind === "reference" && issue.key === target,
              )?.source,
          },
          Error(
            system
              ? `Source target ${target} is absent from rendered destinations; link uses #`
              : `Unresolved ${authored ? "reference" : "link"}: ${target || "empty URL"}; fallback applied`,
          ),
          {
            level: "warning",
            code: system
              ? "reference.rendering"
              : authored
                ? "reference.missing"
                : "link.invalid",
            target,
          },
        );
      }
}
