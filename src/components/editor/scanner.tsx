import { useState, type ReactNode } from "react";
import { Ban, ChevronRight, Loader2, RotateCcw, ScanText, X } from "lucide-react";
import { textOf } from "@/utils/text-of";
import { plugins, type ScanResults } from "@/scanner/plugins";
import { useScan } from "@/hooks/use-scan";

type PunctuationIssue = ScanResults["punctuation"][number];
const visible = (s: string) => s.replace(/ /g, "·").replace(/\n/g, "↵");

function groupByChapter(issues: PunctuationIssue[]) {
    const groups = new Map<string, { chapter: PunctuationIssue["chapter"]; issues: PunctuationIssue[] }>();
    for (const issue of issues) {
        const group = groups.get(issue.chapter.id) ?? { chapter: issue.chapter, issues: [] };
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

const Section = ({ title, count, children }: { title: string; count: number; children: ReactNode }) => (
    <section className="space-y-2">
        <h3 className="flex items-center justify-between px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
            <span>{count}</span>
        </h3>
        {children}
    </section>
);

const ChapterGroup = ({ chapter, issues }: { chapter: PunctuationIssue["chapter"]; issues: PunctuationIssue[] }) => (
    <details className="group rounded-lg border">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs [&::-webkit-details-marker]:hidden">
            <ChevronRight size={14} className="shrink-0 transition-transform group-open:rotate-90" />
            <span className="flex-1 truncate font-medium">{chapter.title}</span>
            <Badge>{issues.length}</Badge>
        </summary>
        <ul className="divide-y border-t">
            {issues.map((issue, i) => (
                <li key={i} className="space-y-1.5 px-3 py-2 text-xs hover:bg-muted/50">
                    <div className="flex items-baseline justify-between gap-2">
                        <span>{issue.message}</span>
                        <span className="shrink-0 text-muted-foreground">Par. {issue.paragraph}</span>
                    </div>
                    <p className="wrap-break-word rounded bg-muted px-2 py-1.5 font-mono leading-relaxed">
                        <span className="text-muted-foreground">{issue.excerpt.before}</span>
                        <mark className="rounded bg-destructive/20 px-0.5 text-destructive">
                            {visible(issue.excerpt.match)}
                        </mark>
                        <span className="text-muted-foreground">{issue.excerpt.after}</span>
                    </p>
                </li>
            ))}
        </ul>
    </details>
);
const FigureRow = ({ kind, label, text }: { kind: string; label: string; text: ReactNode }) => (
    <li className="flex gap-2 px-3 py-2 text-xs hover:bg-muted/50">
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
            {kind} {label}
        </span>
        <span className="line-clamp-2 min-w-0">{text}</span>
    </li>
);

const ProgressBar = ({ done, total, label }: { done: number; total: number; label: string }) => (
    <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
            <span className="truncate">{label}</span>
            <span>{done}/{total}</span>
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
    const { run, cancel, status, current, completed, results, errors } = useScan();

    const figures = results["unreferenced-figures"];
    const punctuation = results.punctuation ?? [];
    const chapters = groupByChapter(punctuation);

    const figureCount = figures ? figures.images.length + figures.tables.length + figures.equations.length : 0;
    const total = punctuation.length + figureCount;
    const scanning = status === "scanning";

    if (!expand) {
        return (
            <button
                onClick={() => setExpand(true)}
                aria-label="Buka scanner"
                className="fixed bottom-5 right-5 flex h-10 w-10 items-center justify-center rounded-full bg-background shadow"
            >
                {scanning ? <Loader2 size={16} className="animate-spin" /> : <ScanText size={16} />}
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
                        {status === "done" && (total ? `${total} temuan` : "Tidak ada masalah")}
                        {status === "cancelled" && `Dibatalkan · ${total} temuan sementara`}
                    </p>
                </div>
                <button onClick={() => setExpand(false)} aria-label="Tutup" className="rounded p-1 hover:bg-muted">
                    <X size={16} />
                </button>
            </header>

            <div className="space-y-3 border-b px-4 py-3">
                {scanning && <ProgressBar done={completed} total={plugins.length} label={current ?? "Menyiapkan…"} />}

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
                        {status === "idle" ? <ScanText size={14} /> : <RotateCcw size={14} />}
                        {status === "idle" ? "Mulai scan" : "Scan ulang"}
                    </button>
                )}
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
                {errors.map((er, i) => (
                    <p key={i} className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                        {er.id !== "*" && <b>{er.id}: </b>}
                        {er.message}
                    </p>
                ))}

                {figures && figureCount > 0 && (
                    <Section title="Tidak dirujuk di teks" count={figureCount}>
                        <ul className="divide-y rounded-lg border">
                            {figures.images.map((g) => (
                                <FigureRow key={g.id} kind="Gambar" label={g.numbering} text={textOf(g.text) || "(tanpa caption)"} />
                            ))}
                            {figures.tables.map((g) => (
                                <FigureRow key={g.id} kind="Tabel" label={g.numbering} text={textOf(g.text) || "(tanpa caption)"} />
                            ))}
                            {figures.equations.map((g) => (
                                <FigureRow key={g.id} kind="Persamaan" label={g.numbering} text={<code>{g.latex}</code>} />
                            ))}
                        </ul>
                    </Section>
                )}

                {chapters.length > 0 && (
                    <Section title="Tanda baca" count={punctuation.length}>
                        <div className="space-y-2">
                            {chapters.map(({ chapter, issues }) => (
                                <ChapterGroup key={chapter.id} chapter={chapter} issues={issues} />
                            ))}
                        </div>
                    </Section>
                )}

                {status === "idle" && (
                    <p className="py-6 text-center text-xs text-muted-foreground">Belum ada hasil. Klik "Mulai scan".</p>
                )}
            </div>
        </div>
    );
};