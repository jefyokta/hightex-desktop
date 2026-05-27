import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Scan,
  ChevronDown,
} from "lucide-react";

import { Scanner as ScannerEngine } from "@/scanner";
import { Document } from "@/editor/document";
import { TabHeader } from "./components/tab-header";
import { Button } from "@/components/ui/button";

type ScanResult = {
  chapterId: string;
  chapterTitle?: string;
  textErrors: TextError[];
  nodeErrors: NodeError[];
};
export function Scanner() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ScanResult[]>([]);

  const scan = async () => {
    setLoading(true);

    try {
      const document = Document.instance;
      if (!document) return;

      await ScannerEngine.init();

      const chaptersData = document.chapters;
      const tempResults: ScanResult[] = [];
      const allErrors: (NodeError | TextError)[] = [];

      for (let i = 0; i < chaptersData.length; i++) {
        const chapter = chaptersData[i];
        const scanner = new ScannerEngine();
        const content = await chapter.getContent();

        const isLast = i === chaptersData.length - 1;

        const nodeErrors = await scanner.scan(content, chapter.getId(), isLast);
        const textErrors = scanner.getTextErrors();

        allErrors.push(...nodeErrors, ...textErrors);

        tempResults.push({
          chapterId: chapter.getId(),
          chapterTitle: chapter.title,
          textErrors: [],
          nodeErrors: [],
        });

        scanner.destroy();
      }
      allErrors.forEach((err) => {
        const targetChapter = tempResults.find(
          (r) => r.chapterId === err.chapterId,
        );
        if (targetChapter) {
          if ("text" in err) {
            targetChapter.textErrors.push(err as TextError);
          } else {
            targetChapter.nodeErrors.push(err as NodeError);
          }
        } else {
          const last = tempResults[tempResults.length - 1];
          if ("text" in last) last.textErrors.push(err as any);
          else last.nodeErrors.push(err as any);
        }
      });

      setResults(tempResults);
    } finally {
      setLoading(false);
    }
  };

  const ok = useMemo(() => {
    return results.every(
      (r) => r.textErrors.length === 0 && r.nodeErrors.length === 0,
    );
  }, [results]);

  return (
    <div className="flex flex-col h-full bg-background">
      <TabHeader title="Scanner" desc="Validate document structure">
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={scan} disabled={loading}>
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Scan className="w-4 h-4" />
            )}
            Scan
          </Button>
        </div>
      </TabHeader>

      <div className="flex-1 overflow-auto p-4 space-y-6">
        {!loading && results.length === 0 && (
          <div className="text-sm text-muted-foreground">
            Click scan to validate document
          </div>
        )}

        {!loading && ok && results.length > 0 ? (
          <Passed />
        ) : (
          results.map((chapter) => (
            <ChapterBlock key={chapter.chapterId} chapter={chapter} />
          ))
        )}
      </div>
    </div>
  );
}

function ChapterBlock({ chapter }: { chapter: ScanResult }) {
  const [openText, setOpenText] = useState(true);
  const [openNode, setOpenNode] = useState(false);

  const hasText = chapter.textErrors.length > 0;
  const hasNode = chapter.nodeErrors?.length || 0 > 0;

  return (
    <section className="border rounded-2xl p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold">
          {chapter.chapterTitle || chapter.chapterId}
        </h3>
        <p className="text-xs text-muted-foreground">Chapter</p>
      </div>
      {!hasNode && !hasText && (
        <Passed chapter={chapter.chapterTitle?.toLocaleLowerCase()} />
      )}

      {hasText && (
        <ErrorSection
          title="Text Errors"
          color="red"
          open={openText}
          onToggle={() => setOpenText(!openText)}
        >
          <GroupedErrors errors={chapter.textErrors} />
        </ErrorSection>
      )}

      {hasNode && (
        <ErrorSection
          title="Node Errors"
          color="yellow"
          open={openNode}
          onToggle={() => setOpenNode(!openNode)}
        >
          <GroupedErrors errors={chapter.nodeErrors} />
        </ErrorSection>
      )}
    </section>
  );
}
function ErrorSection({
  title,
  color,
  open,
  onToggle,
  children,
}: {
  title: string;
  color: "red" | "yellow";
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full border rounded-xl px-3 py-2 bg-muted/30"
      >
        <div className="flex items-center gap-2">
          <AlertCircle
            className={`w-4 h-4 ${
              color === "red" ? "text-red-500" : "text-yellow-500"
            }`}
          />
          <span className="text-sm font-medium">{title}</span>
        </div>

        <ChevronDown
          className={`w-4 h-4 transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && <div className="space-y-2">{children}</div>}
    </div>
  );
}

function GroupedErrors({ errors }: { errors: any[] }) {
  const grouped = useMemo(() => {
    return errors.reduce((acc: Record<string, any[]>, err) => {
      if (!acc[err.name]) acc[err.name] = [];
      acc[err.name].push(err);
      return acc;
    }, {});
  }, [errors]);

  return (
    <div className="space-y-2">
      {Object.entries(grouped).map(([name, items]) => (
        <ErrorGroup key={name} name={name} items={items as any[]} />
      ))}
    </div>
  );
}

function ErrorGroup({ name, items }: { name: string; items: any[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 bg-muted/40 hover:bg-muted/60 transition"
      >
        <div className="text-sm font-medium flex items-center gap-2">
          {name}
          <span className="text-xs text-muted-foreground">
            ({items.length})
          </span>
        </div>

        <ChevronDown
          className={`w-4 h-4 transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="p-2 space-y-2">
          {items.map((err, i) => (
            <div key={i} className="border rounded-lg p-3 space-y-2">
              <div className="text-sm font-medium">{err.title || err.name}</div>

              {err.text && (
                <div className="text-sm bg-muted rounded-md px-3 py-2 whitespace-pre-wrap">
                  <HighlightText text={err.text} match={err.match} />
                </div>
              )}

              <div className="text-xs text-muted-foreground">
                {err.description}
              </div>

              {err.range && (
                <div className="text-[10px] opacity-60">
                  range: {err.range.start} - {err.range.end}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HighlightText({ text, match }: { text: string; match?: RegExp }) {
  if (!match) return <span>{text}</span>;

  const regex = new RegExp(match, "g");

  const parts: { type: "text" | "match"; value: string }[] = [];

  let lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(text)) !== null) {
    const start = m.index;
    const end = start + m[0].length;

    if (start > lastIndex) {
      parts.push({
        type: "text",
        value: text.slice(lastIndex, start),
      });
    }

    parts.push({
      type: "match",
      value: text.slice(start, end),
    });

    lastIndex = end;
  }

  if (lastIndex < text.length) {
    parts.push({
      type: "text",
      value: text.slice(lastIndex),
    });
  }

  return (
    <span>
      {parts.map((p, i) =>
        p.type === "match" ? (
          <mark key={i} className="bg-yellow-300/60 text-black px-1 rounded">
            {p.value}
          </mark>
        ) : (
          <span key={i}>{p.value}</span>
        ),
      )}
    </span>
  );
}

const Passed = ({ chapter }: { chapter?: string }) => (
  <div className="flex gap-3 border rounded-xl p-4">
    <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
    <div>
      <p className="text-sm font-medium">
        No issues found {chapter && `on ${chapter}`}
      </p>
      <p className="text-xs text-muted-foreground">
        {chapter ? `Chapter \`${chapter}\`` : "All Chapters"} passed validation
      </p>
    </div>
  </div>
);
