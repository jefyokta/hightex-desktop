import type { Node as ModelNode } from "@tiptap/pm/model";
import type { DocumentRenderModel } from "@/types/document-snapshot";
import type { ChapterImageResources } from "./image-resources";
import type { chapterRenderContext } from "./render-context";
import { chapterVariables } from "./variables";
import { isReferenceKind } from "../extensions/ref/label";
import { archiveSha256 } from "@/utils/htx/import-model";

/** Only resolved values read by this chapter can invalidate its cached layout. */
export async function chapterLayoutResources(
  source: ModelNode,
  model: DocumentRenderModel,
  context: ReturnType<typeof chapterRenderContext>,
  targets: ReadonlyMap<string, string>,
  images: Pick<ChapterImageResources, "fingerprint">,
) {
  const variables = chapterVariables(model);
  const values: unknown[] = [],
    assets = new Set<string>();
  source.descendants((node) => {
    if (node.type.name === "image") assets.add(node.attrs.src);
    if (node.type.name === "variable")
      values.push([
        "variable",
        node.attrs.name,
        variables.get(node.attrs.name),
      ]);
    if (node.type.name === "cite")
      for (const key of String(node.attrs.cite ?? "")
        .split("|")
        .filter(Boolean))
        values.push(["citation", key, model.references[key]]);
    if (node.type.name === "refComponent") {
      const kind = node.attrs.ref || "imageFigure",
        key = node.attrs.link;
      values.push([
        "reference",
        kind,
        key,
        isReferenceKind(kind)
          ? context.referenceLabels[kind].get(key)
          : undefined,
        targets.get(key),
      ]);
    }
    if (node.type.name === "imageFigure" || node.type.name === "figureTable")
      values.push([
        "caption",
        node.attrs.id,
        context.captionLabels.get(node.attrs.id),
      ]);
    if (node.type.name === "blockMath")
      values.push([
        "equation",
        node.attrs.id,
        context.equations.find((item) => item.id === node.attrs.id)?.pos,
      ]);
  });
  const bytes = await Promise.all(
    Array.from(assets, async (key) => [key, await images.fingerprint(key)]),
  );
  return archiveSha256(
    new TextEncoder().encode(JSON.stringify([values, bytes])),
  );
}
