import { useIPC } from "@/hooks/use-ipc";
import { HighTexDB } from "./hightex-db";
import { compareDocumentBranch } from "./document-comparison";
import { observeDocumentSources as observeComparisonSources } from "./document-source-observer";
export { observeComparisonSources };

export async function openDocumentComparison(
  branchId: string,
  onChange: () => void,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  const branch = await HighTexDB.getInstance().documents.get(branchId);
  signal.throwIfAborted();
  if (!branch?.parentId) throw Error("Document is not a branch");
  const ids = [branch.parentId, branchId];
  // Existing windows flush their own bound, ready editor. No new editor or file save.
  await Promise.all(ids.map((id) => useIPC("editor").editor?.flush?.(id)));
  signal.throwIfAborted();
  const observer = observeComparisonSources(ids, onChange, signal);
  try {
    await observer.ready;
    const comparison = await compareDocumentBranch(branchId);
    signal.throwIfAborted();
    if (comparison.main.id !== ids[0]) throw Error("Branch source changed");
    return { comparison, stop: observer.stop };
  } catch (error) {
    observer.stop();
    throw error;
  }
}
