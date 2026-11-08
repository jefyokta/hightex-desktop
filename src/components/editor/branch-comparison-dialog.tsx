import { Disclosure } from "@/components/ui/disclosure";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, RefreshCw } from "lucide-react";
import { NativeSelect } from "@/components/ui/native-select";
import { ComparisonChapter } from "./comparison-chapter";
import { changedChapterBlocks } from "@/editor/storage/comparison-blocks";
import type { DocumentComparison } from "@/editor/storage/document-comparison";
import { openDocumentComparison } from "@/editor/storage/comparison-session";
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
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [index, setIndex] = useState(0);
  const [stale, setStale] = useState(false);
  useEffect(() => {
    setComparison(undefined);
    setIndex(0);
    setStale(false);
    if (!open || !branchId) return;
    let alive = true;
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    void openDocumentComparison(
      branchId,
      () => {
        if (alive) setStale(true);
      },
      controller.signal,
    )
      .then(({ comparison }) => {
        if (alive) setComparison(comparison);
      })
      .catch((error) => {
        if (alive) {
          console.error("Could not compare branch with main", error);
          setFailed(true);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [open, branchId, retry]);
  const entries = useMemo(
    () =>
      comparison
        ? [
            ...comparison.sections.filter(
              (section) => section.key === "chapters",
            ),
            ...comparison.sections.filter(
              (section) => section.key !== "chapters",
            ),
          ].flatMap((section) =>
            section.entries.map((entry) => ({ section: section.key, entry })),
          )
        : [],
    [comparison],
  );
  const actualIndex = Math.min(index, Math.max(0, entries.length - 1));
  const selected = entries[actualIndex];
  const blocks = useMemo(
    () =>
      selected?.section === "chapters"
        ? changedChapterBlocks(
            JSON.parse(selected.entry.before ?? "[]"),
            JSON.parse(selected.entry.after ?? "[]"),
          )
        : { main: [], branch: [] },
    [selected],
  );
  const label = (item: typeof selected) =>
    item.section === "chapters"
      ? t("editor.branches.compare_chapter", { id: item.entry.key })
      : `${sectionLabel(item.section)} · ${item.section === "images" ? item.entry.key.slice(0, 10) : item.entry.key}`;
  const branchName =
    comparison?.branch.branchName || t("editor.branches.branch");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-tour="branch-comparison-dialog"
        className="flex h-[92dvh] max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[96vw]"
      >
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>
            {comparison
              ? t("editor.branches.compare_title", { name: branchName })
              : t("editor.branches.compare")}
          </DialogTitle>
          <DialogDescription>
            {t("editor.branches.compare_description")}
          </DialogDescription>
        </DialogHeader>
        {stale && comparison && !loading && (
          <div
            className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-amber-500/10 px-5 py-2"
            data-comparison-stale
            role="status"
          >
            <p className="text-xs">{t("editor.branches.compare_stale")}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRetry((value) => value + 1)}
            >
              <RefreshCw className="size-3.5" />
              {t("editor.branches.compare_refresh")}
            </Button>
          </div>
        )}
        {loading ? (
          <p
            role="status"
            className="flex-1 p-10 text-center text-sm text-muted-foreground"
          >
            {t("editor.branches.comparing")}
          </p>
        ) : failed ? (
          <div
            role="alert"
            className="flex flex-1 flex-col items-center justify-center gap-3"
          >
            <p>{t("editor.branches.compare_failed")}</p>
            <Button
              variant="outline"
              onClick={() => setRetry((value) => value + 1)}
            >
              <RefreshCw className="size-4" />
              {t("forms.retry")}
            </Button>
          </div>
        ) : comparison && !entries.length ? (
          <p
            role="status"
            className="flex-1 p-10 text-center text-sm text-muted-foreground"
          >
            {t("editor.branches.compare_no_changes")}
          </p>
        ) : comparison && selected ? (
          <>
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
              <p className="text-xs text-muted-foreground">
                {t("editor.branches.compare_summary", comparison.summary)}
              </p>
              <div
                className="flex items-center gap-2"
                data-comparison-navigation
              >
                <Button
                  variant="outline"
                  size="icon"
                  disabled={actualIndex === 0}
                  aria-label={t("editor.branches.compare_previous")}
                  onClick={() => setIndex(actualIndex - 1)}
                >
                  <ArrowLeft className="size-4" />
                </Button>
                <span className="min-w-14 text-center text-xs" role="status">
                  {actualIndex + 1} / {entries.length}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={actualIndex === entries.length - 1}
                  aria-label={t("editor.branches.compare_next")}
                  onClick={() => setIndex(actualIndex + 1)}
                >
                  <ArrowRight className="size-4" />
                </Button>
              </div>
              <NativeSelect
                wrapperClassName="w-full md:hidden"
                aria-label={t("editor.branches.compare_changes")}
                value={actualIndex}
                onChange={(event) => setIndex(Number(event.target.value))}
              >
                {entries.map((item, i) => (
                  <option key={`${item.section}:${item.entry.key}`} value={i}>
                    {label(item)}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex min-h-0 flex-1">
              <nav
                aria-label={t("editor.branches.compare_changes")}
                className="hidden w-56 shrink-0 space-y-1 overflow-y-auto border-r p-2 md:block"
              >
                {entries.map((item, i) => (
                  <button
                    key={`${item.section}:${item.entry.key}`}
                    type="button"
                    aria-current={i === actualIndex ? "true" : undefined}
                    className={`flex w-full flex-col items-start gap-2 rounded-lg p-3 text-left text-xs hover:bg-muted/60 ${i === actualIndex ? "bg-muted" : ""}`}
                    onClick={() => setIndex(i)}
                  >
                    <span className="break-all font-medium">{label(item)}</span>
                    <Status status={item.entry.status} />
                  </button>
                ))}
              </nav>
              <section
                className="min-w-0 flex-1 overflow-y-auto"
                aria-label={label(selected)}
                data-comparison-entry
              >
                <header className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
                  <h3 className="font-medium">{label(selected)}</h3>
                  <Status status={selected.entry.status} />
                </header>
                {selected.entry.textUnchanged && (
                  <p className="border-b bg-amber-500/10 px-4 py-3 text-xs">
                    {t("editor.branches.compare_formatting_only")}
                  </p>
                )}
                <div className="grid min-w-0 divide-y lg:grid-cols-2 lg:divide-x lg:divide-y-0">
                  {(["main", "branch"] as const).map((side) => (
                    <div key={side} className="min-w-0">
                      <header
                        className={`space-y-1 border-b px-4 py-3 ${side === "main" ? "bg-red-500/5" : "bg-emerald-500/5"}`}
                      >
                        <p className="text-sm font-semibold">
                          {side === "main"
                            ? t("editor.branches.main")
                            : branchName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {side === "main"
                            ? comparison.main.title
                            : comparison.branch.title}
                        </p>
                      </header>
                      {selected.section === "chapters" ? (
                        (
                          side === "main"
                            ? selected.entry.beforeNodes
                            : selected.entry.afterNodes
                        ) ? (
                          <ComparisonChapter
                            model={comparison.sources[side]}
                            nodes={
                              (side === "main"
                                ? selected.entry.beforeNodes
                                : selected.entry.afterNodes)!
                            }
                            chapterId={selected.entry.key}
                            side={side}
                            changed={blocks[side]}
                          />
                        ) : (
                          <p className="p-8 text-center text-sm text-muted-foreground">
                            {t("editor.branches.compare_empty")}
                          </p>
                        )
                      ) : (
                        <ValuePane
                          title={
                            side === "main"
                              ? t("editor.branches.main")
                              : branchName
                          }
                          value={
                            side === "main"
                              ? selected.entry.before
                              : selected.entry.after
                          }
                        />
                      )}
                    </div>
                  ))}
                </div>
                {selected.section === "chapters" &&
                  !selected.entry.textUnchanged && (
                    <Disclosure
                      className="border-t p-4"
                      triggerClassName="cursor-pointer text-xs font-medium"
                      label={t("editor.branches.compare_text_changes")}
                    >
                      <div className="mt-4">
                        <InlineDiff
                          before={selected.entry.beforeText ?? ""}
                          after={selected.entry.afterText ?? ""}
                        />
                      </div>
                    </Disclosure>
                  )}
              </section>
            </div>
          </>
        ) : (
          <div className="flex-1" />
        )}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t p-3">
          <p className="text-xs text-muted-foreground">
            {t("editor.branches.compare_readonly")}
          </p>
          <div className="flex items-center gap-2">
            {comparison && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("editor.branches.compare_refresh")}
                title={t("editor.branches.compare_refresh")}
                disabled={loading}
                onClick={() => setRetry((value) => value + 1)}
              >
                <RefreshCw className="size-4" />
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.close")}
            </Button>
          </div>
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
