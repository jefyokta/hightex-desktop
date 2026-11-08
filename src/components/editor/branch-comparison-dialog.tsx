import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { DocumentComparison } from "@/editor/storage/document-comparison";
import { compareDocumentBranch } from "@/editor/storage/document-comparison";
import { t } from "@/utils/lang";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function Status({ status }: { status: "added" | "removed" | "modified" }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-1 text-xs ${
        status === "added"
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : status === "removed"
            ? "bg-red-500/10 text-red-700 dark:text-red-300"
            : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
      }`}
    >
      {t(`editor.branches.compare_status.${status}`)}
    </span>
  );
}

const sectionLabel = (key: string) => {
  switch (key) {
    case "document":
      return t("editor.branches.compare_section.document");
    case "config":
      return t("editor.branches.compare_section.config");
    case "profile":
      return t("editor.branches.compare_section.profile");
    case "chapters":
      return t("editor.branches.compare_section.chapters");
    case "images":
      return t("editor.branches.compare_section.images");
    case "profilePicture":
      return t("editor.branches.compare_section.profilePicture");
    case "variables":
      return t("editor.branches.compare_section.variables");
    case "aliases":
      return t("editor.branches.compare_section.aliases");
    case "references":
      return t("editor.branches.compare_section.references");
    default:
      return key;
  }
};

export function BranchComparisonDialog({
  open,
  onOpenChange,
  branchId,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  branchId?: string;
}) {
  const [comparison, setComparison] = useState<DocumentComparison>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !branchId) return;
    let alive = true;
    setLoading(true);
    setComparison(undefined);
    void compareDocumentBranch(branchId)
      .then((value) => {
        if (alive) setComparison(value);
      })
      .catch((error) => {
        console.error("Could not compare branch with main", error);
        if (alive) toast.error(t("editor.branches.compare_failed"));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, branchId]);

  const total = comparison
    ? Object.values(comparison.summary).reduce((sum, count) => sum + count, 0)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle>
            {comparison
              ? t("editor.branches.compare_title", {
                  name: comparison.branch.branchName || comparison.branch.title,
                })
              : t("editor.branches.compare")}
          </DialogTitle>
          <DialogDescription>
            {t("editor.branches.compare_description")}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[76dvh] space-y-4 overflow-y-auto p-5">
          {loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t("editor.branches.comparing")}
            </p>
          ) : comparison && total === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t("editor.branches.compare_no_changes")}
            </p>
          ) : comparison ? (
            <>
              <p className="rounded-lg bg-muted/50 px-4 py-3 text-sm">
                {t("editor.branches.compare_summary", {
                  added: comparison.summary.added,
                  removed: comparison.summary.removed,
                  modified: comparison.summary.modified,
                })}
              </p>
              {comparison.sections.some(
                (section) => section.key === "chapters",
              ) && (
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-3 rounded-sm bg-red-500/20" />
                    {t("editor.branches.compare_removed")}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-3 rounded-sm bg-emerald-500/20" />
                    {t("editor.branches.compare_added")}
                  </span>
                </div>
              )}
              {comparison.sections.map((section) => (
                <details key={section.key} className="group rounded-xl border">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl bg-muted/40 px-4 py-3 font-medium">
                    <span>{sectionLabel(section.key)}</span>
                    <span className="rounded-full bg-background px-2 py-1 text-xs text-muted-foreground">
                      {section.entries.length}
                    </span>
                  </summary>
                  <div className="space-y-3 p-3">
                    {section.entries.map((entry) => (
                      <article
                        key={entry.key}
                        className="overflow-hidden rounded-lg border"
                      >
                        <header className="flex items-center justify-between gap-3 border-b px-3 py-2">
                          <p className="min-w-0 truncate text-sm font-medium">
                            {section.key === "images" && entry.key.length > 24
                              ? `${t("editor.branches.image_asset")} ${entry.key.slice(0, 10)}`
                              : entry.key}
                          </p>
                          <Status status={entry.status} />
                        </header>
                        {section.key === "chapters" ? (
                          <>
                            <div className="overflow-x-auto bg-background p-4">
                              <InlineDiff
                                before={entry.beforeText ?? ""}
                                after={entry.afterText ?? ""}
                              />
                            </div>
                            {entry.textUnchanged && (
                              <details className="border-t">
                                <summary className="cursor-pointer px-4 py-3 text-xs text-muted-foreground">
                                  {t("editor.branches.compare_formatting_only")}
                                </summary>
                                <div className="grid divide-y md:grid-cols-2 md:divide-x md:divide-y-0">
                                  <ValuePane
                                    title={t("editor.branches.main")}
                                    value={entry.before}
                                  />
                                  <ValuePane
                                    title={
                                      comparison.branch.branchName ||
                                      t("editor.branches.branch")
                                    }
                                    value={entry.after}
                                  />
                                </div>
                              </details>
                            )}
                          </>
                        ) : (
                          <div className="grid divide-y md:grid-cols-2 md:divide-x md:divide-y-0">
                            <ValuePane
                              title={t("editor.branches.main")}
                              value={entry.before}
                            />
                            <ValuePane
                              title={
                                comparison.branch.branchName ||
                                t("editor.branches.branch")
                              }
                              value={entry.after}
                            />
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                </details>
              ))}
            </>
          ) : null}
        </div>
        <div className="flex justify-end border-t p-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ValuePane({ title, value }: { title: string; value?: string }) {
  return (
    <div className="min-w-0 p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{title}</p>
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words font-sans text-xs leading-relaxed">
        {value || t("editor.branches.compare_empty")}
      </pre>
    </div>
  );
}

type DiffSegment = { type: "same" | "added" | "removed"; text: string };

function mergeSegments(segments: DiffSegment[]): DiffSegment[] {
  return segments.reduce<DiffSegment[]>((result, segment) => {
    if (!segment.text) return result;
    const previous = result[result.length - 1];
    if (previous?.type === segment.type) previous.text += segment.text;
    else result.push({ ...segment });
    return result;
  }, []);
}

function tokenize(text: string) {
  return text.match(/[\p{L}\p{N}_]+|\s+|[^\s\p{L}\p{N}_]/gu) ?? [];
}

function diffMiddle(before: string[], after: string[]): DiffSegment[] {
  if (before.length * after.length > 80_000)
    return [
      { type: "removed", text: before.join("") },
      { type: "added", text: after.join("") },
    ];

  const matrix = Array.from(
    { length: before.length + 1 },
    () => new Uint32Array(after.length + 1),
  );
  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      matrix[i][j] =
        before[i] === after[j]
          ? matrix[i + 1][j + 1] + 1
          : Math.max(matrix[i + 1][j], matrix[i][j + 1]);
    }
  }

  const segments: DiffSegment[] = [];
  let i = 0;
  let j = 0;
  while (i < before.length && j < after.length) {
    if (before[i] === after[j]) {
      segments.push({ type: "same", text: before[i++] });
      j++;
    } else if (matrix[i + 1][j] >= matrix[i][j + 1]) {
      segments.push({ type: "removed", text: before[i++] });
    } else {
      segments.push({ type: "added", text: after[j++] });
    }
  }
  while (i < before.length)
    segments.push({ type: "removed", text: before[i++] });
  while (j < after.length) segments.push({ type: "added", text: after[j++] });
  return mergeSegments(segments);
}

function diffText(beforeText: string, afterText: string): DiffSegment[] {
  const before = tokenize(beforeText);
  const after = tokenize(afterText);
  let start = 0;
  while (
    start < before.length &&
    start < after.length &&
    before[start] === after[start]
  )
    start++;

  let beforeEnd = before.length;
  let afterEnd = after.length;
  while (
    beforeEnd > start &&
    afterEnd > start &&
    before[beforeEnd - 1] === after[afterEnd - 1]
  ) {
    beforeEnd--;
    afterEnd--;
  }

  return mergeSegments([
    { type: "same", text: before.slice(0, start).join("") },
    ...diffMiddle(before.slice(start, beforeEnd), after.slice(start, afterEnd)),
    { type: "same", text: before.slice(beforeEnd).join("") },
  ]);
}

function InlineDiff({ before, after }: { before: string; after: string }) {
  const segments = diffText(before, after);
  if (!segments.length)
    return (
      <p className="text-sm text-muted-foreground">
        {t("editor.branches.compare_empty")}
      </p>
    );
  return (
    <p
      className="whitespace-pre-wrap break-words"
      style={{
        fontFamily: '"Times New Roman", serif',
        fontSize: "12pt",
        lineHeight: 1.5,
        textAlign: "justify",
        textIndent: "1.27cm",
      }}
    >
      {segments.map((segment, index) =>
        segment.type === "added" ? (
          <ins
            key={index}
            className="rounded-sm bg-emerald-500/20 text-emerald-950 decoration-emerald-700 dark:text-emerald-100 dark:decoration-emerald-300"
          >
            {segment.text}
          </ins>
        ) : segment.type === "removed" ? (
          <del
            key={index}
            className="rounded-sm bg-red-500/15 text-red-900 line-through decoration-red-700 dark:text-red-100 dark:decoration-red-300"
          >
            {segment.text}
          </del>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </p>
  );
}
