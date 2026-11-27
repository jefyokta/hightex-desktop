import { useIPC } from "@/hooks/use-ipc";
import { useAppLanguage } from "@/hooks/use-app-language";
import { PageHeader } from "@/components/dashboard/page-header";
import { FileText, FileUp, Library } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Job, ProgressJob } from "@/components/splitter/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { PDFDocument } from "pdf-lib";
import { ApplicationError } from "@/exception/interfaces/application-error";
import { strToU8, zipSync } from "fflate";
import { ShouldSilent } from "@/exception/should-silent";
import { ShouldNotified } from "@/exception/interfaces/should-notified";
import { toast } from "sonner";
import { ParsedItalic } from "@/utils/parse-italic";
import { truncate } from "@/utils/truncate";
import { cn } from "@/lib/utils";
import { t } from "@/utils/lang";
import { generateDocumentPDF } from "@/document-export/generate";
import { paginationReport } from "@/editor/pagination/report-error";
import { ShouldReport } from "@/exception/should-report";
import { readSplitPlan, type SplitPlan } from "@/document-export/split-plan";
import { SplitPages } from "@/document-export/split-pages";

type MainDocument =
  | {
      type: "pdf";
      file: File | null;
    }
  | {
      type: "hightex";
      document: HighTexDocument | null;
    };

type SplitContext = {
  original: PDFDocument;
  privatePdf: PDFDocument;
  publicPdf: PDFDocument;
  plan: SplitPlan;
  publicCopy: SplitPages;
  privateCopy: SplitPages;
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const translate = (
  key: string,
  replacements: Record<string, string | number> = {},
) => {
  let value = t(key as any);

  for (const [name, replacement] of Object.entries(replacements)) {
    value = value.replace(
      new RegExp(`\\{${name}\\}`, "g"),
      String(replacement),
    );
  }

  return value;
};

const documents = [
  {
    key: "statement",
    title: t("split.statement.title"),
    description: t("split.ensure_signed"),
  },
  {
    key: "approval",
    title: t("split.approval.title"),
    description: t("split.ensure_signed"),
  },
  {
    key: "plagiarism",
    title: t("split.plagiarism.title"),
    description: t("split.ensure_signed_stamped"),
  },
] as const;

export const Splitter = () => {
  useAppLanguage();
  const [docs, setDocs] = useState<HighTexDocument[]>([]);
  const [started, setStarted] = useState(false);

  const [inputs, setInputs] = useState({
    statement: null as File | null,
    approval: null as File | null,
    plagiarism: null as File | null,

    doc: {
      type: "pdf",
      file: null,
    } as MainDocument,
  });

  const [error, setError] = useState<string>();
  const [progress, setProgress] = useState<string>();

  useEffect(() => {
    HighTexDB.getMainDocuments().then(setDocs);
  }, []);

  const add = async (
    source: PDFDocument,
    target: PDFDocument,
    pageIndex = 0,
  ) => {
    const [page] = await target.copyPages(source, [pageIndex]);

    target.addPage(page);
  };

  const jobs = useMemo<Job[]>(() => {
    const tasks: Job[] = [];

    if (inputs.doc.type === "hightex") {
      const selected = inputs.doc.document;
      tasks.push({
        name: t("split.compile_document"),
        task: async (_, setProgress: (progress: string) => void, signal: AbortSignal) => {
          if (!selected?.id) {
            throw new Error(t("split.document_not_selected"));
          }
          const { id, title } = selected;

          setProgress(
            translate("split.compiling_document", {
              title: truncate(title, 10).replace("_", ""),
            }),
          );

          try {
            const buffer = await generateDocumentPDF(id, signal, { watermark: true });
            return new File([new Uint8Array(buffer)], "document.pdf", { type: "application/pdf" });
          } catch (error) {
            throw paginationReport(error, "Kompilasi PDF Split") ?? error;
          }
        },
      });
    }

    tasks.push({
      name: t("split.reading_main_document"),
      task: async (
        file: File | undefined,
        setProgress: (progress: string) => void,
      ) => {
        if (!file) {
          file =
            inputs.doc.type === "pdf"
              ? (inputs.doc.file ?? undefined)
              : undefined;
        }

        if (!file) {
          throw new Error(t("split.main_document_not_found"));
        }

        setProgress(t("split.loading_document"));

        const pdf = await PDFDocument.load(await file.arrayBuffer());

        let plan: SplitPlan;
        try {
          setProgress(t("split.reading_metadata"));

          plan = readSplitPlan(pdf.getSubject(), pdf.getPageCount());
        } catch {
          throw new Error(t("split.invalid_pdf"));
        }
        const publicPdf = await PDFDocument.create(), privatePdf = await PDFDocument.create();
        const payload: SplitContext = {
          original: pdf,
          privatePdf,
          publicPdf,
          plan,
          publicCopy: new SplitPages(pdf, publicPdf),
          privateCopy: new SplitPages(pdf, privatePdf),
        };
        await payload.publicCopy.append(Array.from({ length: plan.cover.end - plan.cover.start + 1 }, (_, index) => plan.cover.start - 1 + index));
        return payload;
      },
    });

    tasks.push({
      name: t("split.merge_statement"),
      task: async (
        context: SplitContext,
        setProgress: (progress: string) => void,
      ) => {
        if (!inputs.statement) {
          throw new Error(t("split.statement_required"));
        }

        setProgress(t("split.merge_statement_progress"));

        await sleep(800);

        await add(
          await PDFDocument.load(await inputs.statement.arrayBuffer()),
          context.publicPdf,
        );

        return context;
      },
    });

    tasks.push({
      name: t("split.merge_consent"),
      task: async (
        context: SplitContext,
        setProgress: (progress: string) => void,
      ) => {
        setProgress(t("split.merge_consent_progress"));

        await sleep(800);

        if (!inputs.approval) {
          throw new Error(t("split.consent_required"));
        }

        await add(
          await PDFDocument.load(await inputs.approval.arrayBuffer()),
          context.publicPdf,
        );

        return context;
      },
    });

    tasks.push({
      name: t("split.merge_plagiarism"),
      task: async (
        context: SplitContext,
        setProgress: (progress: string) => void,
      ) => {
        if (!inputs.plagiarism) {
          throw new Error(t("split.plagiarism_required"));
        }

        setProgress(t("split.merge_plagiarism_progress"));

        await add(
          await PDFDocument.load(await inputs.plagiarism.arrayBuffer()),
          context.publicPdf,
        );

        await sleep(800);

        return context;
      },
    });

    tasks.push({
      name: t("split.generate_output"),
      task: async (
        context: SplitContext,
        setProgress: (progress: string) => void,
        signal: AbortSignal,
      ) => {
        const copyRange = async (
          range: { start: number; end: number },
          target: SplitPages,
          label: string,
        ) => {
          const total = range.end - range.start + 1;
          const pageIndexes: number[] = [];

          for (let page = range.start; page <= range.end; page++) {
            signal.throwIfAborted();
            pageIndexes.push(page - 1);

            const current = page - range.start + 1;

            setProgress(
              translate("split.copying_page", {
                label,
                current,
                total,
                page,
              }),
            );

            await sleep(100);
          }

          await target.append(pageIndexes);
        };

        setProgress(t("split.preparing_public"));

        for (const range of context.plan.publicRanges) {
          await copyRange(
            range,
            context.publicCopy,
            t("split.building_public"),
          );
        }

        setProgress(t("split.preparing_private"));

        for (const range of context.plan.privateRanges) {
          await copyRange(
            range,
            context.privateCopy,
            t("split.building_private"),
          );
        }

        setProgress(t("split.saving_pdf"));

        context.publicCopy.finish();
        context.privateCopy.finish();

        const publicPdf = await context.publicPdf.save();
        const privatePdf = await context.privatePdf.save();
        const originalPdf = await context.original.save();

        setProgress(t("split.creating_zip"));

        const zip = zipSync({
          "public.pdf": publicPdf,
          "private.pdf": privatePdf,
          "original.pdf": originalPdf,
          "payload.json": strToU8(JSON.stringify(context.plan.payload)),
        });

        setProgress(t("split.saving_archive"));

        await sleep(500);

        signal.throwIfAborted();
        return useIPC("file").file.save("splitted.zip", zip);
      },
    });

    return tasks;
  }, [inputs]);

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        eyebrow={t("workspace.tools")}
        title={t("split.title")}
        description={t("split.subtitle")}
      />

      <div className="space-y-6 rounded-2xl border bg-card p-6 shadow-sm">
        <div className="rounded-xl border p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <FileText className="h-5 w-5 text-primary" />
            </div>

            <div className="flex-1">
              <h3 className="font-medium">{t("split.main_document.title")}</h3>

              <p className="mt-1 text-sm text-muted-foreground">
                {t("split.main_document.description")}
              </p>

              <RadioGroup
                className="mt-5 flex gap-6"
                value={inputs.doc.type}
                onValueChange={(value: "pdf" | "hightex") =>
                  setInputs((previous) => ({
                    ...previous,
                    doc:
                      value === "pdf"
                        ? {
                            type: "pdf",
                            file: null,
                          }
                        : {
                            type: "hightex",
                            document: null,
                          },
                  }))
                }
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="pdf" id="main-pdf" />

                  <Label htmlFor="main-pdf" className="flex items-center gap-2">
                    <FileUp className="h-4 w-4" />
                    {t("split.main_document.pdf")}
                  </Label>
                </div>

                <div className="flex items-center gap-2">
                  <RadioGroupItem value="hightex" id="main-hightex" />

                  <Label
                    htmlFor="main-hightex"
                    className="flex items-center gap-2"
                  >
                    <Library className="h-4 w-4" />
                    {t("split.main_document.hightex")}
                  </Label>
                </div>
              </RadioGroup>

              {inputs.doc.type === "pdf" ? (
                <div className="mt-5">
                  <Input
                    type="file"
                    accept="application/pdf"
                    onChange={(event) =>
                      setInputs((previous) => ({
                        ...previous,
                        doc: {
                          type: "pdf",
                          file: event.target.files?.[0] ?? null,
                        },
                      }))
                    }
                  />
                </div>
              ) : (
                <div className="mt-5">
                  <Select
                    onValueChange={(id) => {
                      const document = docs.find((doc) => doc.id === id);

                      if (!document) {
                        return;
                      }

                      setInputs((previous) => ({
                        ...previous,
                        doc: {
                          type: "hightex",
                          document,
                        },
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={t("split.main_document.select")}
                      />
                    </SelectTrigger>

                    <SelectContent>
                      {docs.map((doc) => (
                        <SelectItem key={doc.id} value={doc.id}>
                          <ParsedItalic text={truncate(doc.title)} />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <p className="mt-4 text-sm text-muted-foreground">
                {t("split.public_policy")}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {documents.map((document) => (
            <div key={document.key} className="rounded-xl border p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <FileText className="h-5 w-5 text-primary" />
                </div>

                <div className="flex-1">
                  <h3 className="font-medium">
                    <ParsedItalic text={document.title} />
                  </h3>

                  <p className="mt-1 text-sm text-muted-foreground">
                    {document.description}
                  </p>

                  <div className="mt-4">
                    <Input
                      type="file"
                      accept="application/pdf"
                      onChange={(event) =>
                        setInputs((previous) => ({
                          ...previous,
                          [document.key]: event.target.files?.[0] ?? null,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <ProgressJob
          jobs={jobs}
          started={started}
          onSuccess={(result) => {
            setStarted(false);
            setProgress(t("split.success"));

            toast.success(t("split.success_title"), {
              description: translate("split.success_description", {
                path: result,
              }),
            });
          }}
          onError={(_, err) => {
            setStarted(false);
            setProgress(undefined);
            setError(ApplicationError.normilize(err));

            console.error(err);

            if (err instanceof ShouldReport) throw err;

            if (err instanceof ShouldSilent) {
              throw new ShouldNotified(err.message);
            }
          }}
          onProgress={setProgress}
        />

        <div className="my-4 flex h-11 items-center justify-center overflow-hidden rounded-2xl border px-3 text-xs">
          <p
            className={cn(
              "text-center transition-all duration-300 ease-in-out",
              error ? "text-destructive" : "text-muted-foreground",
              started && !error && "animate-pulse",
            )}
          >
            {error && typeof error === "string"
              ? error
              : started
                ? progress
                : t("split.ready")}
          </p>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={async () => {
              setStarted(true);
              setProgress(undefined);
              setError(undefined);
            }}
            disabled={started}
          >
            {t("split.start")}
          </Button>
        </div>
      </div>
    </div>
  );
};
