import { useEffect, useMemo, useRef, useState } from "react";
import { liveQuery } from "dexie";
import { Check, Download, FileStack, Loader2, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { FormInputs } from "@/components/forms/form-inputs";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Checkbox } from "@/components/ui/checkbox";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { ParsedItalic, parseItalic } from "@/utils/parse-italic";
import { name } from "@/utils/name";
import { t, useAppLanguage } from "@/utils/lang";
import {
  FORM_CATALOG,
  PERSON_LABELS,
  buildFormSheets,
  buildFormFiles,
  committee,
  defaultSelection,
  documentFormData,
  emptyFormData,
  formLabel,
  formTitle,
  resolveFormData,
  type FormCode,
  type FormData,
  type FormPrintInput,
  type FormSelection,
  type FormStage,
} from "@/forms/model";

interface FormDraft {
  version: 2;
  stage: FormStage;
  internId: string;
  inputs: Partial<Record<FormStage, Partial<FormData>>>;
  choices: Partial<Record<FormStage, FormSelection[]>>;
}
const draftKey = (id: string) => `hightex:forms:v1:${id}`;
function readDraft(id: string): FormDraft {
  const empty: FormDraft = {
    version: 2,
    stage: "proposal",
    internId: "",
    inputs: {},
    choices: {},
  };
  try {
    const saved = JSON.parse(localStorage.getItem(draftKey(id)) ?? "null");
    if (
      ![1, 2].includes(saved?.version) ||
      !["proposal", "defense"].includes(saved.stage)
    )
      return empty;
    const inputs: FormDraft["inputs"] = {};
    const choices: FormDraft["choices"] = {};
    for (const stage of ["proposal", "defense"] as const) {
      // Migrate only administrative fields; faculty input in old drafts is discarded.
      if (saved.inputs?.[stage])
        inputs[stage] = resolveFormData(emptyFormData(), saved.inputs[stage]);
      if (Array.isArray(saved.choices?.[stage]))
        choices[stage] = defaultSelection(stage).filter((item) =>
          saved.choices[stage].some(
            (choice: FormSelection) => choice?.code === item.code,
          ),
        );
    }
    return {
      ...empty,
      stage: saved.stage,
      internId: typeof saved.internId === "string" ? saved.internId : "",
      inputs,
      choices,
    };
  } catch {
    return empty;
  }
}
function PreviewFrame({
  input,
  index,
}: {
  input: FormPrintInput;
  index: number;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [request] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    setBusy(true);
    setError("");
    const timeout = setTimeout(() => {
      setBusy(false);
      setError(t("forms.preview_failed"));
    }, 120000);
    const listener = (event: MessageEvent) => {
      if (
        event.source !== frame.current?.contentWindow ||
        event.origin !== location.origin ||
        event.data?.request !== request
      )
        return;
      if (event.data.type === "forms:ready")
        frame.current?.contentWindow?.postMessage(
          { type: "forms:init", request, input, index },
          location.origin,
        );
      if (event.data.type === "forms:rendered") {
        clearTimeout(timeout);
        setBusy(false);
      }
      if (event.data.type === "forms:error") {
        clearTimeout(timeout);
        setBusy(false);
        setError(event.data.message);
      }
    };
    window.addEventListener("message", listener);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("message", listener);
    };
  }, [input, index, request, retry]);
  return error ? (
    <div role="alert" className="space-y-3 p-5 text-sm">
      <p>{error}</p>
      <Button
        type="button"
        variant="outline"
        onClick={() => setRetry((value) => value + 1)}
      >
        <RefreshCw />
        {t("forms.retry")}
      </Button>
    </div>
  ) : (
    <div className="relative overflow-hidden">
      {busy && (
        <div
          role="status"
          className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-background/85 text-xs"
        >
          <Loader2 className="size-4 animate-spin" />
          {t("forms.rendering")}
        </div>
      )}
      <iframe
        key={retry}
        ref={frame}
        title={t("forms.original_preview")}
        src={`/forms/print?request=${request}&retry=${retry}`}
        className="block h-[68vh] min-h-96 w-full border-0"
      />
    </div>
  );
}
function PDFPreview({ input }: { input: FormPrintInput }) {
  const files = useMemo(() => buildFormFiles(input), [input]);
  const [index, setIndex] = useState(0);
  const [preview, setPreview] = useState({ input, index, revision: 0 });
  const actualIndex = Math.min(index, files.length - 1);
  useEffect(() => {
    const timer = setTimeout(
      () =>
        setPreview((state) => ({
          input,
          index: actualIndex,
          revision: state.revision + 1,
        })),
      250,
    );
    return () => clearTimeout(timer);
  }, [input, actualIndex]);
  return (
    <div
      className="overflow-hidden rounded-xl border bg-muted/25"
      data-form-preview
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <span className="text-xs font-medium">
          {t("forms.original_preview")}
        </span>
        {files.length > 1 && (
          <NativeSelect
            aria-label={t("forms.preview_sheet")}
            value={actualIndex}
            onChange={(event) => setIndex(Number(event.target.value))}
            className="h-8 text-xs"
          >
            {files.map((file, i) => (
              <option key={file.filename} value={i}>
                {file.label}
              </option>
            ))}
          </NativeSelect>
        )}
      </div>
      <PreviewFrame
        key={preview.revision}
        input={preview.input}
        index={preview.index}
      />
    </div>
  );
}
function FormWorkspace({
  document,
  documents,
  defaultProfile,
}: {
  document: HighTexDocument;
  documents: HighTexDocument[];
  defaultProfile?: Profile;
}) {
  const [draft, setDraft] = useState(() => readDraft(document.id));
  const [activeCode, setActiveCode] = useState<FormCode>("TA07");
  const [busy, setBusy] = useState(false);
  const exporting = useRef(false);
  const [message, setMessage] = useState("");
  const [storageError, setStorageError] = useState(false);
  const source = useMemo(
    () =>
      documentFormData(
        document,
        documents.find((doc) => doc.id === draft.internId),
        draft.stage,
        defaultProfile,
      ),
    [document, documents, draft.internId, draft.stage, defaultProfile],
  );
  const data = useMemo(
    () => resolveFormData(source, draft.inputs[draft.stage]),
    [source, draft.inputs, draft.stage],
  );
  const selection = useMemo(
    () => draft.choices[draft.stage] ?? defaultSelection(draft.stage),
    [draft.choices, draft.stage],
  );
  const forms = FORM_CATALOG.filter((form) =>
    form.stages.includes(draft.stage),
  );
  const current = forms.some((form) => form.code === activeCode)
    ? activeCode
    : forms[0].code;
  const input = useMemo<FormPrintInput>(
    () => ({ documentId: document.id, stage: draft.stage, data, selection }),
    [document.id, draft.stage, data, selection],
  );
  const preview = useMemo<FormPrintInput>(
    () => ({ ...input, selection: [{ code: current }] }),
    [input, current],
  );
  const sheets = buildFormSheets(input);
  const ready = Boolean(
    data.name.trim() && data.nim.trim() && data.title.trim() && sheets.length,
  );
  useEffect(() => {
    try {
      localStorage.setItem(draftKey(document.id), JSON.stringify(draft));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [document.id, draft]);
  const updateData = (next: FormData) => {
    const extra = structuredClone(next);
    delete extra.secondAdvisor;
    for (const key of Object.keys(source) as (keyof FormData)[])
      if (
        typeof source[key] === "string" &&
        String(source[key]).trim() &&
        !["program", "city"].includes(key)
      )
        Object.assign(extra, { [key]: "" });
    for (const role of Object.keys(
      PERSON_LABELS,
    ) as (keyof FormData["people"])[]) {
      if (!["head", "internAdvisor"].includes(role)) {
        extra.people[role] = { name: "", nip: "" };
        continue;
      }
      if (source.people[role].name.trim()) extra.people[role].name = "";
      if (source.people[role].nip.trim()) extra.people[role].nip = "";
    }
    setDraft((state) => ({
      ...state,
      inputs: { ...state.inputs, [state.stage]: extra },
    }));
  };
  const choose = (next: FormSelection[]) =>
    setDraft((state) => ({
      ...state,
      choices: { ...state.choices, [state.stage]: next },
    }));
  const exportArchive = async () => {
    if (exporting.current || !ready) return;
    exporting.current = true;
    setBusy(true);
    setMessage("");
    try {
      const result = await window.formPrint.export(input);
      if (result) setMessage(t("forms.zip_saved", { path: result.path }));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : t("forms.export_failed"),
      );
    } finally {
      exporting.current = false;
      setBusy(false);
    }
  };
  return (
    <form
      data-tour="forms-workspace"
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        void exportArchive();
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div
          data-tour="forms-stage"
          className="flex rounded-lg bg-muted/50 p-1"
          role="group"
          aria-label={t("forms.stage")}
        >
          {(["proposal", "defense"] as const).map((stage) => (
            <Button
              type="button"
              key={stage}
              disabled={busy}
              variant={draft.stage === stage ? "outline" : "ghost"}
              aria-pressed={draft.stage === stage}
              onClick={() => setDraft((state) => ({ ...state, stage }))}
            >
              {t(stage === "proposal" ? "forms.proposal" : "forms.defense")}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {t("forms.zip_count", { count: sheets.length })}
          </span>
          <Button
            data-tour="forms-export"
            type="submit"
            disabled={!ready || busy}
          >
            {busy ? <Loader2 className="animate-spin" /> : <Download />}
            {t(busy ? "forms.exporting" : "forms.download_zip")}
          </Button>
        </div>
      </div>
      <div className="rounded-xl border px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <Check className="size-4 text-muted-foreground" />
          <strong>{data.name || t("forms.identity")}</strong>
          <span className="text-muted-foreground">{data.nim}</span>
          <span className="text-xs text-muted-foreground">
            {t(
              document.profile
                ? "forms.document_profile_source"
                : "forms.local_profile_source",
            )}
          </span>
        </div>
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-muted-foreground">
            {t("forms.view_source_data")}
          </summary>
          <p className="mt-3 text-xs text-muted-foreground">
            {t("forms.people_hint")}
          </p>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
            {committee(data)
              .concat("head")
              .filter((role) => data.people[role].name)
              .map((role) => (
                <div key={role}>
                  <dt className="text-muted-foreground">
                    {PERSON_LABELS[role]}
                  </dt>
                  <dd className="mt-0.5">
                    {name(data.people[role].name)}
                    {data.people[role].nip && ` · ${data.people[role].nip}`}
                  </dd>
                </div>
              ))}
          </dl>
        </details>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <fieldset
          data-tour="forms-selection"
          disabled={busy}
          className="min-w-0 rounded-xl border"
        >
          <div className="flex items-center justify-between border-b px-3 py-3">
            <span className="text-xs font-semibold">
              {t("forms.choose_forms")}
            </span>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => choose(defaultSelection(draft.stage))}
              >
                {t("forms.all")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => choose([])}
              >
                {t("forms.clear")}
              </Button>
            </div>
          </div>
          <div className="divide-y">
            {forms.map((form) => {
              const selected = selection.some(
                (item) => item.code === form.code,
              );
              return (
                <div
                  key={form.code}
                  className={`relative flex items-center gap-2 px-3 ${current === form.code ? "bg-muted/50" : ""}`}
                >
                  <Checkbox
                    checked={selected}
                    aria-label={`${formLabel(form.code)} ${form.title}`}
                    onCheckedChange={(checked) =>
                      choose(
                        checked
                          ? [...selection, { code: form.code }]
                          : selection.filter((item) => item.code !== form.code),
                      )
                    }
                  />
                  <button
                    type="button"
                    className="min-w-0 flex-1 py-3 text-left"
                    aria-pressed={current === form.code}
                    data-view-form={form.code}
                    onClick={() => setActiveCode(form.code)}
                  >
                    <span className="text-xs font-semibold">
                      {formLabel(form.code)}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
                      {form.title}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
          <p className="border-t p-3 text-[11px] leading-relaxed text-muted-foreground">
            {t("forms.zip_hint")}
          </p>
        </fieldset>
        <div className="min-w-0 space-y-4">
          <div>
            <h2 className="text-sm font-semibold">
              {formLabel(current)} · {formTitle(current)}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {t("forms.faculty_blank")}
            </p>
          </div>
          <fieldset data-tour="forms-inputs" disabled={busy}>
            <FormInputs
              code={current}
              data={data}
              source={source}
              documents={documents.filter((doc) => doc.id !== document.id)}
              internId={draft.internId}
              onInternChange={(internId) =>
                setDraft((state) => ({ ...state, internId }))
              }
              onChange={updateData}
            />
          </fieldset>
          {!ready && (
            <p className="text-xs text-muted-foreground">
              {t("forms.complete_identity")}
            </p>
          )}
          {message && (
            <p
              role="status"
              className="rounded-lg border p-3 text-xs break-words"
            >
              {message}
            </p>
          )}
          {storageError && (
            <p role="alert" className="text-xs text-destructive">
              {t("forms.storage_failed")}
            </p>
          )}
          <div data-tour="forms-preview">
            <PDFPreview input={preview} />
          </div>
        </div>
      </div>
    </form>
  );
}
export function Forms() {
  useAppLanguage();
  const [documents, setDocuments] = useState<HighTexDocument[]>([]);
  const [documentId, setDocumentId] = useState("");
  const [profile, setProfile] = useState<Profile>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    const refreshProfile = () => {
      void window.profile
        ?.get()
        .then((profile) => {
          if (active) setProfile(profile);
        })
        .catch(() => {});
    };
    refreshProfile();
    window.addEventListener("focus", refreshProfile);
    const subscription = liveQuery(() =>
      HighTexDB.getMainDocuments(),
    ).subscribe({
      next: (docs) => {
        if (!active) return;
        setDocuments(
          docs.sort(
            (a, b) =>
              new Date(b.updatedAt ?? 0).getTime() -
              new Date(a.updatedAt ?? 0).getTime(),
          ),
        );
        setLoading(false);
      },
      error: () => {
        if (active) {
          setError(true);
          setLoading(false);
        }
      },
    });
    return () => {
      active = false;
      subscription.unsubscribe();
      window.removeEventListener("focus", refreshProfile);
    };
  }, [retry]);
  const document = documents.find((doc) => doc.id === documentId);
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("workspace.tools")}
        title={t("forms.title")}
        description={t("forms.subtitle")}
      />
      {loading ? (
        <p
          role="status"
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <Loader2 className="size-4 animate-spin" />
          {t("forms.loading")}
        </p>
      ) : error ? (
        <div role="alert" className="space-y-3">
          <p>{t("forms.load_failed")}</p>
          <Button
            onClick={() => setRetry((value) => value + 1)}
            variant="outline"
          >
            {t("forms.retry")}
          </Button>
        </div>
      ) : !documents.length ? (
        <div
          data-tour="forms-empty"
          className="rounded-xl border p-8 text-center"
        >
          <FileStack className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="text-sm">{t("forms.no_documents")}</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <label htmlFor="forms-document" className="text-xs font-medium">
              {t("forms.document")}
            </label>
            <NativeSelect
              id="forms-document"
              value={documentId}
              onChange={(event) => setDocumentId(event.target.value)}
            >
              <option value="">{t("forms.choose_document")}</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {parseItalic(doc.title)
                    .map((part) => part.text)
                    .join("")}
                </option>
              ))}
            </NativeSelect>
            {document && (
              <p className="text-xs text-muted-foreground">
                <ParsedItalic text={document.title} />
              </p>
            )}
          </div>
          {document ? (
            <FormWorkspace
              key={document.id}
              document={document}
              documents={documents}
              defaultProfile={profile}
            />
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
              <FileStack className="size-9 text-muted-foreground" />
              <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                {t("forms.start_hint")}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
