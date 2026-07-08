import { FileText, FileUp, Library } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Job, ProgressJob } from "@/components/splitter/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    RadioGroup,
    RadioGroupItem,
} from "@/components/ui/radio-group";
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
import { strToU8, zipSync, } from "fflate";
import { ShouldSilent } from "@/exception/should-silent";
import { ShouldNotified } from "@/exception/interfaces/should-notified";
import { toast } from "sonner";
import { ParsedItalic } from "@/utils/parse-italic";
import { truncate } from "@/utils/truncate";

type MainDocument =
    | {
        type: "pdf";
        file: File | null;
    }
    | {
        type: "hightex";
        document: HighTexDocument | null;
    };


const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

type SplitContext = {
    original: PDFDocument,
    splitAtPage: number,
    privatePdf: PDFDocument,
    publicPdf: PDFDocument
    continueAtPage: number,
    payload?: ExportPayload
}

const documents = [
    {
        key: "statement",
        title: "Statment Sheet",
        description: "Ensure it's signed",
    },
    {
        key: "approval",
        title: "Consent Sheet",
        description: "Ensure it's signed",
    },
    {
        key: "plagiarism",
        title: "Plagiarms",
        description: "Ensure it's signed and stampped",
    },
] as const;

export const Splitter = () => {
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
    const [error, setError] = useState<string>()

    useEffect(() => {
        HighTexDB.getDocuments().then(setDocs);
    }, []);

    const [progress, setProgress] = useState<string>()
    const add = async (src: PDFDocument, target: PDFDocument, i: number = 0) => {
        const [p] = await target.copyPages(src, [i])
        target.addPage(p)
    }

    const jobs = useMemo<Job[]>(() => {
        const tasks: Job[] = [];

        if (inputs.doc.type === "hightex") {
            tasks.push({
                name: "Compile PDF",
                task: async (_, setProgress: (p: string) => void) => {
                    const { id = undefined, title } = (inputs.doc as Extract<MainDocument, { type: "hightex" }>).document!;

                    if (!id) throw new Error("No Document Selected!")
                    setProgress(`Compiling document ${truncate(title, 10).replace("_", "")}`)
                    const buffer: Uint8Array = await window.ipcRenderer.invoke(
                        "hightex:pdf:silent",
                        id,
                        true
                    );

                    await sleep(1500);

                    return new File([new Uint8Array(buffer)], 'document')
                },
            });
        }

        tasks.push({
            name: "Reading Main Document",
            task: async (file: File | undefined, setProgress: (p: string) => void) => {
                if (!file) {
                    file = (inputs.doc as Extract<MainDocument, { type: "pdf" }>).file || undefined
                }
                if (!file) throw new Error("Main document not found")
                setProgress("Loading document")
                const pdf = await PDFDocument.load(await file.arrayBuffer());
                setProgress("Creating empty document")

                const payload: SplitContext = {
                    original: pdf,
                    privatePdf: await PDFDocument.create(),
                    publicPdf: await PDFDocument.create(),
                    splitAtPage: 0,
                    continueAtPage: 0
                }

                try {
                    setProgress("Reading meta data")

                    const exportPayload: ExportPayload = JSON.parse(pdf.getSubject()!);
                    const c = exportPayload.chapters?.slice(3);
                    if (!c || !c?.length) {
                        throw new Error;
                    }

                    payload.splitAtPage = c[0].page;
                    payload.continueAtPage = c[c.length - 1].page
                    payload.payload = exportPayload
                    await add(pdf, payload.publicPdf, 0)
                    return payload

                } catch (error) {
                    throw new Error("Invalid PDF: pdf must be produce by Hightex");

                }

            },
        });



        tasks.push({
            name: "Merge Statement",
            task: async (s: SplitContext, setProgress: (p: string) => void) => {
                if (!inputs.statement) throw new Error("Statement file is required")
                setProgress("Adding statment page to public.pdf")
                await sleep(800);
                await add(await PDFDocument.load(await inputs.statement!.arrayBuffer()), s.publicPdf)
                return s;
            },
        });


        tasks.push({
            name: "Merge Constent",
            task: async (s: SplitContext, setProgress: (p: string) => void) => {
                setProgress("Adding consent page to public.pdf")

                await sleep(800);
                if (!inputs.approval) throw new Error("Constent file is required")

                await add(await PDFDocument.load(await inputs.approval!.arrayBuffer()), s.publicPdf)

                return s;
            },
        });

        tasks.push({
            name: "Merge Plagiarism",
            task: async (s: SplitContext, setProgress: (p: string) => void) => {
                if (!inputs.plagiarism) throw new Error("Plagiarism file is required");
                setProgress("Adding plagiarsm page to public.pdf")
                await add(await PDFDocument.load(await inputs.plagiarism.arrayBuffer()), s.publicPdf)
                await sleep(800);
                return s;
            },
        });


        tasks.push({
            name: "Generate Output",
            task: async (s: SplitContext, setProgress: (p: string) => void) => {
                const chapterKeys = Object.keys(s.payload!.detail).sort();

                const publicChapters = chapterKeys.filter((_, i) =>
                    i <= 2 || i >= chapterKeys.length - 2
                );

                const privateChapters = chapterKeys.filter((_, i) =>
                    !(i <= 2 || i >= chapterKeys.length - 2)
                );

                const copyRange = async (
                    range: { start: number; end: number },
                    srcDoc: PDFDocument,
                    targetDoc: PDFDocument,
                    label: string
                ) => {
                    const total = range.end - range.start + 1;
                    const pageIndexes: number[] = [];

                    for (let page = range.start; page <= range.end; page++) {
                        pageIndexes.push(page - 1);

                        const current = page - range.start + 1;
                        setProgress(
                            `${label} (${current}/${total}) - Copying page ${page}`
                        );

                        await sleep(100);
                    }

                    const copiedPages = await targetDoc.copyPages(srcDoc, pageIndexes);

                    for (const page of copiedPages) {
                        targetDoc.addPage(page);
                    }
                };

                setProgress("Preparing public.pdf...");

                await copyRange(
                    {
                        start: 4,
                        end: s.payload!.detail[Number(publicChapters[0])].start - 1,
                    },
                    s.original,
                    s.publicPdf,
                    "Building public.pdf"
                );

                for (const key of publicChapters) {
                    await copyRange(
                        s.payload!.detail[Number(key)],
                        s.original,
                        s.publicPdf,
                        "Building public.pdf"
                    );
                }

                setProgress("Preparing private.pdf...");

                for (const key of privateChapters) {
                    await copyRange(
                        s.payload!.detail[Number(key)],
                        s.original,
                        s.privatePdf,
                        "Building private.pdf"
                    );
                }

                setProgress("Saving PDF files...");

                const publicPdf = await s.publicPdf.save();
                const privatePdf = await s.privatePdf.save();
                const originalPdf = await s.original.save();

                setProgress("Creating ZIP archive...");

                const zip = zipSync({
                    "public.pdf": publicPdf,
                    "private.pdf": privatePdf,
                    "original.pdf": originalPdf,
                    "payload.json": strToU8(JSON.stringify(s.payload ?? {})),
                });

                setProgress("Saving archive...");

                await sleep(500);

                return window.file.save("splitted.zip", zip);
            },
        });

        return tasks;
    }, [inputs]);

    return (
        <div className="max-w-4xl space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                    Split Your Document
                </h1>

                <p className="mt-2 text-sm text-muted-foreground">
                    Separate supporting pages from your thesis document before
                    publishing it to the repository.
                </p>
            </div>

            <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-6">
                <div className="rounded-xl border p-5">
                    <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-primary/10 p-2">
                            <FileText className="h-5 w-5 text-primary" />
                        </div>

                        <div className="flex-1">
                            <h3 className="font-medium">
                                Main Thesis Document
                            </h3>

                            <p className="text-sm text-muted-foreground mt-1">
                                Choose a PDF or an existing HighTex document.
                            </p>

                            <RadioGroup
                                className="mt-5 flex gap-6"
                                value={inputs.doc.type}
                                onValueChange={(value: any) =>
                                    setInputs((prev) => ({
                                        ...prev,
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
                                    <RadioGroupItem
                                        value="pdf"
                                        id="main-pdf"
                                    />
                                    <Label
                                        htmlFor="main-pdf"
                                        className="flex items-center gap-2"
                                    >
                                        <FileUp className="h-4 w-4" />
                                        PDF File
                                    </Label>
                                </div>

                                <div className="flex items-center gap-2">
                                    <RadioGroupItem
                                        value="hightex"
                                        id="main-hightex"
                                    />
                                    <Label
                                        htmlFor="main-hightex"
                                        className="flex items-center gap-2"
                                    >
                                        <Library className="h-4 w-4" />
                                        HighTex Document
                                    </Label>
                                </div>
                            </RadioGroup>

                            {inputs.doc.type === "pdf" ? (
                                <div className="mt-5">
                                    <Input
                                        type="file"
                                        accept="application/pdf"
                                        onChange={(e) =>
                                            setInputs((prev) => ({
                                                ...prev,
                                                doc: {
                                                    type: "pdf",
                                                    file:
                                                        e.target.files?.[0] ??
                                                        null,
                                                },
                                            }))
                                        }
                                    />
                                </div>
                            ) : (
                                <div className="mt-5">
                                    <Select
                                        onValueChange={(id) => {
                                            const doc = docs.find(
                                                (d) => d.id === id
                                            );

                                            if (!doc) return;

                                            setInputs((prev) => ({
                                                ...prev,
                                                doc: {
                                                    type: "hightex",
                                                    document: doc,
                                                },
                                            }));
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select HighTex document" />
                                        </SelectTrigger>

                                        <SelectContent>
                                            {docs.map((doc) => (
                                                <SelectItem
                                                    key={doc.id}
                                                    value={doc.id}
                                                >
                                                    <ParsedItalic text={truncate(doc.title)} />
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    {documents.map((doc) => (
                        <div
                            key={doc.key}
                            className="rounded-xl border p-5"
                        >
                            <div className="flex items-start gap-3">
                                <div className="rounded-lg bg-primary/10 p-2">
                                    <FileText className="h-5 w-5 text-primary" />
                                </div>

                                <div className="flex-1">
                                    <h3 className="font-medium">
                                        {doc.title}
                                    </h3>

                                    <p className="mt-1 text-sm text-muted-foreground">
                                        {doc.description}
                                    </p>

                                    <div className="mt-4">
                                        <Input
                                            type="file"
                                            accept="application/pdf"
                                            onChange={(e) =>
                                                setInputs((prev) => ({
                                                    ...prev,
                                                    [doc.key]:
                                                        e.target.files?.[0] ??
                                                        null,
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
                    onSuccess={(res) => {
                        setStarted(false);
                        setProgress("Splitted succesfully!")

                        toast.success("Split Success", {
                            description: `saved to ${res}`
                        })

                    }}
                    onError={(_, err) => {
                        setStarted(false);
                        setProgress(undefined)
                        setError(ApplicationError.normilize(err))
                        console.error(err)
                        if (err instanceof ShouldSilent) throw new ShouldNotified(err.message)
                    }}
                    onProgress={setProgress}
                />
                <div className="h-11 flex items-center justify-center rounded-2xl p-2 my-4 border text-xs">
                    {!error && !started && <p className="text-muted-foreground">Let start splitting</p>}
                    {started && progress && <p className="text-muted-foreground">{progress}</p>}
                    {error && typeof error == 'string' && <p className="text-center text-destructive ">{error}</p>}
                </div>


                <div className="flex justify-end">
                    <Button
                        onClick={async () => {
                            setStarted(true)
                            setProgress(undefined)
                            setError(undefined)
                        }}
                        disabled={started}
                    >
                        Start Split
                    </Button>
                </div>
            </div>
        </div>
    );
};