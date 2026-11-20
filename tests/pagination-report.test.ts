import { expect, test } from "bun:test";
import { paginationReport } from "../src/editor/pagination/report-error";
import { ShouldReport } from "../src/exception/should-report";
import { EditorPDFStateError } from "../src/exception/editor-pdf-state-error";
import { DocumentEngineError } from "../src/exception/document-engine-error";
import { ApplicationError } from "../src/exception/interfaces/application-error";
import { loadSource } from "./helpers/load-source";

test("unexpected pagination errors retain cause and diagnostic in the existing report action", () => {
  const cause = new Error("Table pagination did not converge");
  const failure = new DocumentEngineError({ runId: "run", documentId: "doc", sectionId: "4", stage: "section" }, cause);
  const report = paginationReport(failure, "Ekspor PDF experimental")!;
  expect(report).toBeInstanceOf(ShouldReport);
  expect(report.cause).toBe(failure);
  expect(report.description).toContain(cause.message);
  expect(report.description).toContain('"sectionId":"4"');
  expect(report.description).toContain('"runId":"run"');
  expect((report.action as { props: { description: string } }).props.description).toBe(report.description);
  expect(paginationReport(report, "already classified")).toBe(report);
});

test("cancelled and retryable editor states do not become unexpected reports", () => {
  expect(paginationReport(new DOMException("Cancelled", "AbortError"), "export")).toBeUndefined();
  const retry = new EditorPDFStateError("Source changed; retry export");
  expect(retry.message).toBe("Source changed; retry export");
  expect(paginationReport(retry, "export")).toBeUndefined();
  expect(paginationReport("Unexpected native failure", "export")).toBeInstanceOf(ShouldReport);
  expect(paginationReport(new ApplicationError("Unexpected application failure"), "export")).toBeInstanceOf(ShouldReport);
  const warning = new DocumentEngineError({ runId: "run", documentId: "doc", stage: "references" }, Error("Missing ref"),
    { level: "warning", code: "reference.missing" });
  expect(paginationReport(warning, "export")).toBeUndefined();
});

test("ShouldReport keeps the original cause without adding undefined to the visible details", () => {
  const plain = new ShouldReport("Failure");
  expect(plain.description).toBe("Failure");
  const cause = new Error("Original reason"), report = new ShouldReport("Context", cause);
  expect(report.cause).toBe(cause);
  expect(report.description).toBe("Context\nOriginal reason");
  expect((report.action as { props: { description: string } }).props.description).toBe(report.description);
  const circular: { self?: unknown } = {};circular.self = circular;
  expect(new ShouldReport("Unexpected payload", circular).cause).toBe(circular);
});

test("experimental IPC marks unexpected service failures for local reporting and releases the job", async () => {
  const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
  class MainReport extends Error {}
  class Handled extends Error {}
  const cause = new Error("Native page count changed");
  let cancelled = false;
  const { EditorPDFExperimentalHandlers } = loadSource<typeof import("../electron/handlers/editor-pdf-experimental-handlers")>(
    new URL("../electron/handlers/editor-pdf-experimental-handlers.ts", import.meta.url), {
      "../utilities/ipc-main": { IPCMain: { handle: (name: string, handler: (...args: unknown[]) => Promise<unknown>) => handlers.set(name, handler) } },
      "../service/editor-pdf-experimental-service": { EditorPDFExperimentalService: class {
        async export(_input: unknown, signal: AbortSignal) {
          if (cancelled) {
            await handlers.get("experimental:editor-pdf:cancel")!(event, "request");
            signal.throwIfAborted();
          }
          throw cause;
        }
      } },
      "../exception/should-report": { ShouldReport: MainReport },
      "../exception/interface/handled": { Handled },
    });
  EditorPDFExperimentalHandlers.register();
  let listeners = 0;
  const event = { senderFrame: { processId: 1, routingId: 2 }, sender: {
    id: 1, mainFrame: { processId: 1, routingId: 2 },
    once: () => { listeners++; }, removeListener: () => { listeners--; }, isDestroyed: () => false,
  } };
  const run = () => handlers.get("experimental:editor-pdf:export")!(event, {}, "request");
  for (let attempt = 0; attempt < 2; attempt++) {
    const failure = await run().catch(error => error) as Error;
    expect(failure).toBeInstanceOf(MainReport);
    expect(failure.cause).toBe(cause);
    expect(failure.message).toContain(cause.message);
    expect(listeners).toBe(0);
  }
  cancelled = true;
  const aborted = await run().catch(error => error) as Error;
  expect(aborted.name).toBe("AbortError");
  expect(aborted).not.toBeInstanceOf(MainReport);
  expect(listeners).toBe(0);
});
