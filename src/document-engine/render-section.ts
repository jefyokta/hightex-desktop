import { abortable } from "@/utils/abortable";
import type {
  DocumentSection,
  EnginePhase,
  EngineRenderers,
  RenderedSection,
} from "@/types/document-engine";
import type { DocumentEngineRun } from "./run";
import { ChapterContentError } from "@/exception/chapter-content-error";
import { DocumentEngineError } from "@/exception/document-engine-error";

/** Route once, publish phase hooks, and retain ownership until the caller adopts output. */
export async function renderSection(
  definition: DocumentSection,
  renderers: EngineRenderers,
  run: DocumentEngineRun,
  phase: EnginePhase,
  pass: number,
): Promise<RenderedSection> {
  run.stage("section", definition);
  await run.hook("section.before", {
    section: Object.freeze(structuredClone(definition)),
    phase,
    pass,
  });
  const context = { runId: run.id, signal: run.signal };
  const pending =
    definition.kind === "editor"
      ? renderers.editor.render(definition, context)
      : renderers.template.render(definition, context);
  let result: RenderedSection;
  try {
    result = await abortable(pending, run.signal);
  } catch (error) {
    if (run.signal.aborted)
      void pending.then((late) => late.destroy()).catch(() => {});
    throw error;
  }
  try {
    run.signal.throwIfAborted();
    if (!result.pages.length) throw Error("Section renderer returned no pages");
    const reported = new Set<string>();
    for (const issue of result.issues ?? []) {
      if (issue.kind === "reference") continue; // Final target ownership is resolved after composition.
      const key = `${issue.kind}\0${issue.key}\0${issue.source?.from ?? ""}`;
      if (reported.has(key)) continue;
      reported.add(key);
      await run.report(
        new DocumentEngineError(
          { ...run.diagnostic, source: issue.source },
          new ChapterContentError([issue]),
        ),
      );
    }
    await run.hook("section.after", {
      pages: result.pages.length,
      phase,
      pass,
    });
    if (definition.kind === "editor")
      await run.hook("chapter", {
        chapterId: definition.chapter,
        title: definition.title,
        pages: result.pages.length,
      });
    return result;
  } catch (error) {
    result.destroy();
    throw error;
  }
}
