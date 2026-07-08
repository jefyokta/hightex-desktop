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
import { zipSync, } from "fflate";
import { ShouldSilent } from "@/exception/should-silent";
import { ShouldNotified } from "@/exception/interfaces/should-notified";
import { toast } from "sonner";

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
    continueAtPage: number
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
    const add = async (src: PDFDocument, target: PDFDocument, i: number = 0) => {
        const [p] = await target.copyPages(src, [i])
        target.addPage(p)
    }

    const jobs = useMemo<Job[]>(() => {
        const tasks: Job[] = [];

        if (inputs.doc.type === "hightex") {
            tasks.push({
                name: "Compile PDF",
                task: async () => {
                    const id = (inputs.doc as Extract<MainDocument, { type: "hightex" }>).document?.id;
                    if (!id) throw new Error("No Document Selected!")
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
            task: async (file?: File) => {
                if (!file) {
                    file = (inputs.doc as Extract<MainDocument, { type: "pdf" }>).file || undefined
                }
                if (!file) throw new Error("Main document not found")

                const pdf = await PDFDocument.load(await file.arrayBuffer());

                const payload: SplitContext = {
                    original: pdf,
                    privatePdf: await PDFDocument.create(),
                    publicPdf: await PDFDocument.create(),
                    splitAtPage: 0,
                    continueAtPage: 0
                }

                try {
                    const exportPayload: ExportPayload = JSON.parse(pdf.getSubject()!);
                    const c = exportPayload.chapters?.slice(3);
                    if (!c || !c?.length) {
                        throw new Error;
                    }
                    payload.splitAtPage = c[0].page - 1;
                    payload.continueAtPage = c[c.length - 1].page - 1
                    await add(pdf, payload.publicPdf, 0)
                    return payload

                } catch (error) {
                    throw new Error("Invalid PDF: pdf must be produce by Hightex");

                }

            },
        });



        tasks.push({
            name: "Merge Statement",
            task: async (s: SplitContext) => {
                if (!inputs.statement) throw new Error("Statement file is required")

                await add(await PDFDocument.load(await inputs.statement!.arrayBuffer()), s.publicPdf)
                return s;
            },
        });


        tasks.push({
            name: "Merge Constent",
            task: async (s: SplitContext) => {
                await sleep(800);
                if (!inputs.approval) throw new Error("Constent file is required")

                await add(await PDFDocument.load(await inputs.approval!.arrayBuffer()), s.publicPdf)

                return s;
            },
        });

        tasks.push({
            name: "Merge Plagiarism",
            task: async (s: SplitContext) => {
                if (!inputs.plagiarism) throw new Error("Plagiarism file is required")
                await add(await PDFDocument.load(await inputs.plagiarism.arrayBuffer()), s.publicPdf)
                await sleep(800);
                return s;
            },
        });


        tasks.push({
            name: "Generate Output",
            task: async (s: SplitContext) => {
                const before = s.publicPdf.getPageCount() - 1;
                let pagesToCopy = []
                for (let index = before; index < s.splitAtPage; index++) {
                    pagesToCopy.push((index))
                }
                for (let index = s.continueAtPage; index < s.original.getPageCount() - 1; index++) {
                    pagesToCopy.push((index))
                }
                const copiedPages = await s.publicPdf.copyPages(s.original, pagesToCopy)
                for (const page of copiedPages) {
                    s.publicPdf.addPage(page);
                }
                pagesToCopy = [];
                for (let index = s.splitAtPage; index < s.continueAtPage; index++) {
                    pagesToCopy.push(index)
                }
                const copiedPages2 = await s.privatePdf.copyPages(s.original, pagesToCopy)
                for (const page of copiedPages2) {
                    s.privatePdf.addPage(page);
                }
                const zip = zipSync({
                    'public.pdf': await s.publicPdf.save(),
                    'private.pdf': await s.privatePdf.save(),
                    'original.pdf': await s.original.save()

                })
                await sleep(1000);
                return window.file.save(`splitted.zip`, zip)

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
                                                    {doc.title}
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
                        toast.success("Split Success", {
                            description: `saved to ${res}`
                        })

                    }}
                    onError={(_, err) => {
                        setStarted(false);
                        setError(ApplicationError.normilize(err))
                        if (err instanceof ShouldSilent) throw new ShouldNotified(err.message)
                    }}
                />
                <div className="h-11 flex items-center justify-center rounded-2xl p-2 my-4 border text-xs">
                    {!error && !started && <p className="text-muted-foreground">Let start splitting</p>}
                    {started && <>Wait we for all job to finish</>}
                    {error && typeof error == 'string' && <p className="text-center text-destructive ">{error}</p>}
                </div>


                <div className="flex justify-end">
                    <Button
                        onClick={async () => {
                            setStarted(true)
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