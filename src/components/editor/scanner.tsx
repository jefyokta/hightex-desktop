import { useMemo, useState, type ReactNode } from "react";
import {
  Ban,
  ChevronRight,
  Loader2,
  RotateCcw,
  ScanText,
  X,
} from "lucide-react";
import { textOf } from "@/utils/text-of";
import {
  plugins,
  type ScanResults,
  type ScanDiagnostic,
} from "@hightex/scanner";
import { useScan } from "@/hooks/use-scan";
import { useScannerNavigation } from "@/hooks/use-scanner-navigation";
import { diagnosticLocationKey } from "@/scanner/navigation";
import { Counter } from "tjsn-parser";

type PunctuationIssue = ScanResults["punctuation"][number];
const visible = (s: string) => s.replace(/ /g, "·").replace(/\n/g, "↵");

function groupByChapter(issues: PunctuationIssue[]) {
  const groups = new Map<
    string,
    { chapter: PunctuationIssue["chapter"]; issues: PunctuationIssue[] }
  >();
  for (const issue of issues) {
    const group = groups.get(issue.chapter.id) ?? {
      chapter: issue.chapter,
      issues: [],
    };
    group.issues.push(issue);
    groups.set(issue.chapter.id, group);
  }
  return [...groups.values()];
}

const Badge = ({ children }: { children: ReactNode }) => (
  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
    {children}
  </span>
);

const Section = ({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) => (
  <section className="space-y-2">
    <h3 className="flex items-center justify-between px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {title}
      <span>{count}</span>
    </h3>
    {children}
  </section>
);

const ChapterGroup = ({
  chapter,
  issues,
  diagnostics,
}: {
  chapter: PunctuationIssue["chapter"];
  issues: PunctuationIssue[];
  diagnostics: Map<string, ScanDiagnostic>;
}) => (
  <details className="group rounded-lg border">
    <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs [&::-webkit-details-marker]:hidden">
      <ChevronRight
        size={14}
        className="shrink-0 transition-transform group-open:rotate-90"
      />
      <span className="flex-1 truncate font-medium">{chapter.title}</span>
      <Badge>{issues.length}</Badge>
    </summary>
    <ul className="divide-y border-t">
      {issues.map((issue, i) => (
        <PunctuationRow
          key={i}
          issue={issue}
          diagnostic={diagnostics.get(
            diagnosticLocationKey({
              pluginId: "punctuation",
              chapterId: issue.chapter.id,
              path: issue.path,
              range: issue.range,
            }),
          )}
        />
      ))}
    </ul>
  </details>
);

const PunctuationRow = ({
  issue,
  diagnostic,
}: {
  issue: PunctuationIssue;
  diagnostic?: ScanDiagnostic;
}) => {
  const navigate = useScannerNavigation();

  return (
    <li>
      <button
        type="button"
        onClick={() => diagnostic && navigate(diagnostic)}
        disabled={!diagnostic}
        className="block w-full cursor-pointer space-y-1.5 px-3 py-2 text-left text-xs hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="flex items-baseline justify-between gap-2">
          <span>{issue.message}</span>
          <span className="shrink-0 text-muted-foreground">
            Par. {issue.paragraph}
          </span>
        </span>
        <span className="block wrap-break-word rounded bg-muted px-2 py-1.5 font-mono leading-relaxed">
          <span className="text-muted-foreground">{issue.excerpt.before}</span>
          <mark className="rounded bg-destructive/20 px-0.5 text-destructive">
            {visible(issue.excerpt.match)}
          </mark>
          <span className="text-muted-foreground">{issue.excerpt.after}</span>
        </span>
      </button>
    </li>
  );
};

const FigureRow = ({
  kind,
  label,
  text,
  diagnostic,
}: {
  kind: string;
  label: string;
  text: ReactNode;
  diagnostic?: ScanDiagnostic;
}) => {
  const navigate = useScannerNavigation();
  return (
    <li>
      <button
        type="button"
        disabled={!diagnostic}
        className="flex w-full cursor-pointer gap-2 px-3 py-2 text-left text-xs hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        onClick={() => diagnostic && navigate(diagnostic)}
      >
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
          {kind} {label}
        </span>
        <span className="line-clamp-2 min-w-0">{text}</span>
      </button>
    </li>
  );
};

const ProgressBar = ({
  done,
  total,
  label,
}: {
  done: number;
  total: number;
  label: string;
}) => (
  <div className="space-y-1.5">
    <div className="flex justify-between text-xs text-muted-foreground">
      <span className="truncate">{label}</span>
      <span>
        {done}/{total}
      </span>
    </div>
    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-foreground transition-[width] duration-300"
        style={{ width: `${total ? (done / total) * 100 : 0}%` }}
      />
    </div>
  </div>
);

export const Scanner = () => {
  const [expand, setExpand] = useState(false);
  const {
    run,
    cancel,
    status,
    current,
    completed,
    results,
    errors,
    diagnostics,
  } = useScan();
  const diagnosticIndex = useMemo(
    () =>
      new Map(diagnostics.map((item) => [diagnosticLocationKey(item), item])),
    [diagnostics],
  );

  const figures = results["unreferenced-figures"];
  const punctuation = results.punctuation ?? [];
  const chapters = groupByChapter(punctuation);

  const figureRows = useMemo(() => {
    if (!figures) return [];
    return [
      ...figures.images.map((graph) => ({
        graph,
        kind: "Gambar",
        label: graph.numbering,
        text: textOf(graph.text) || "(tanpa caption)",
      })),
      ...figures.tables.map((graph) => ({
        graph,
        kind: "Tabel",
        label: graph.numbering,
        text: textOf(graph.text) || "(tanpa caption)",
      })),
      ...figures.equations.map((graph) => ({
        graph,
        kind: "Persamaan",
        label: graph.numbering,
        text: <code>{graph.latex}</code>,
      })),
      ...figures.headings.map((graph) => ({
        graph,
        kind: "Lampiran",
        label: Counter.getAlpha(Number(graph.numbering)),
        text: textOf(graph.text) || "(tanpa judul)",
      })),
    ];
  }, [figures]);
  const figureCount = figureRows.length;
  const total = punctuation.length + figureCount;
  const scanning = status === "scanning";

  if (!expand) {
    return (
      <button
        onClick={() => setExpand(true)}
        aria-label="Buka scanner"
        className="fixed bottom-5 right-5 flex h-10 w-10 items-center justify-center rounded-full bg-background shadow"
      >
        {scanning ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <ScanText size={16} />
        )}
        {!scanning && total > 0 && (
          <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] text-white">
            {total}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 flex max-h-[75vh] w-96 flex-col overflow-hidden rounded-xl bg-background shadow-lg">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Scanner</h2>
          <p className="text-xs text-muted-foreground">
            {status === "idle" && "Cek referensi dan tanda baca"}
            {scanning && "Sedang memeriksa…"}
            {status === "done" &&
              (total ? `${total} temuan` : "Tidak ada masalah")}
            {status === "cancelled" && `Dibatalkan · ${total} temuan sementara`}
            {status === "failed" &&
              `Pemeriksaan gagal · ${total} temuan sementara`}
          </p>
        </div>
        <button
          onClick={() => setExpand(false)}
          aria-label="Tutup"
          className="rounded p-1 hover:bg-muted"
        >
          <X size={16} />
        </button>
      </header>

      <div className="space-y-3 border-b px-4 py-3">
        {scanning && (
          <ProgressBar
            done={completed}
            total={plugins.length}
            label={current ?? "Menyiapkan…"}
          />
        )}

        {scanning ? (
          <button
            onClick={cancel}
            className="flex w-full items-center justify-center gap-2 rounded-md border py-2 text-xs hover:bg-muted"
          >
            <Ban size={14} /> Batalkan
          </button>
        ) : (
          <button
            onClick={run}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-foreground py-2 text-xs text-background hover:opacity-90"
          >
            {status === "idle" ? (
              <ScanText size={14} />
            ) : (
              <RotateCcw size={14} />
            )}
            {status === "idle" ? "Mulai scan" : "Scan ulang"}
          </button>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {errors.map((er, i) => (
          <p
            key={i}
            className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            {er.id !== "*" && <b>{er.id}: </b>}
            {er.message}
          </p>
        ))}

        {figureCount > 0 && (
          <Section title="Tidak dirujuk di teks" count={figureCount}>
            <ul className="divide-y rounded-lg border">
              {figureRows.map(({ graph, kind, label, text }) => (
                <FigureRow
                  key={graph.chapterId + ":" + graph.path.join(".")}
                  diagnostic={diagnosticIndex.get(
                    diagnosticLocationKey({
                      pluginId: "unreferenced-figures",
                      chapterId: graph.chapterId,
                      path: graph.path,
                    }),
                  )}
                  kind={kind}
                  label={label}
                  text={text}
                />
              ))}
            </ul>
          </Section>
        )}

        {chapters.length > 0 && (
          <Section title="Tanda baca" count={punctuation.length}>
            <div className="space-y-2">
              {chapters.map(({ chapter, issues }) => (
                <ChapterGroup
                  key={chapter.id}
                  chapter={chapter}
                  issues={issues}
                  diagnostics={diagnosticIndex}
                />
              ))}
            </div>
          </Section>
        )}

        {status === "idle" && (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Belum ada hasil. Klik "Mulai scan".
          </p>
        )}
      </div>
    </div>
  );
};
