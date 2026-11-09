import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { liveQuery } from "dexie";
import { Link } from "react-router-dom";
import { Download, FileStack, Loader2, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  FormInputs,
  type FormInputContext,
} from "@/components/forms/form-inputs";
import { formPackageProblems } from "@/forms/fields";
import { FormDraftRecovery } from "@/components/forms/form-draft-recovery";
import { useFormDraft } from "@/forms/use-form-draft";
import {
  emptyWorkspaceFormDraft,
  formDraftData,
  formDraftSelection,
  updateFormDraft,
  type WorkspaceFormDraft,
} from "@/forms/draft";
import { confirm } from "@/utils/confirm";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Checkbox } from "@/components/ui/checkbox";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { parseItalic } from "@/utils/parse-italic";
import { t, useAppLanguage } from "@/utils/lang";
import {
  FORM_CATALOG,
  buildFormSheets,
  buildFormFiles,
  defaultSelection,
  documentFormData,
  formLabel,
  formTitle,
  resolveFormData,
  type FormCode,
  type FormPrintInput,
  type FormSelection,
  type FormStage,
} from "@/forms/model";

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
        setPreview((state) =>
          state.input === input && state.index === actualIndex
            ? state
            : {
                input,
                index: actualIndex,
                revision: state.revision + 1,
              },
        ),
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
  context,
  draft,
  setDraft,
  busy,
  setBusy,
}: {
  document: HighTexDocument;
  context: FormInputContext;
  draft: WorkspaceFormDraft;
  setDraft: Dispatch<SetStateAction<WorkspaceFormDraft>>;
  busy: boolean;
  setBusy(busy: boolean): void;
}) {
  const [activeCode, setActiveCode] = useState<FormCode>("TA07");
  const exporting = useRef(false);
  const [message, setMessage] = useState("");
  const { source, data } = context;
  const selection = useMemo(() => formDraftSelection(draft), [draft]);
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
  const problems = formPackageProblems(
    data,
    draft.stage,
    selection.map((item) => item.code),
  );
  const invalid = problems.filter((item) => item.problem !== "missing");
  const ready = Boolean(
    source.name.trim() &&
    source.nim.trim() &&
    source.title.trim() &&
    sheets.length &&
    !draft.conflicts.length &&
    !invalid.length,
  );
  const choose = (next: FormSelection[]) =>
    setDraft((state) => ({
      ...state,
      values: {
        ...state.values,
        [`${state.stage}.choices`]: JSON.stringify(next),
      },
      conflicts: state.conflicts.filter(
        (conflict) => conflict.field !== `${state.stage}.choices`,
      ),
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
      {(invalid.length > 0 ||
        !source.name.trim() ||
        !source.nim.trim() ||
        !source.title.trim() ||
        !sheets.length) && (
        <div
          data-form-package-review
          className="rounded-lg border p-3 text-xs"
          role="status"
        >
          {invalid.length > 0 ? (
            <p className="text-destructive">
              {t("forms.data_fix_before_export")}:{" "}
              {invalid.map((item) => item.field.label).join(", ")}
            </p>
          ) : (
            <p>{t("forms.complete_identity")}</p>
          )}
        </div>
      )}
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
          {message && (
            <p
              role="status"
              className="rounded-lg border p-3 text-xs break-words"
            >
              {message}
            </p>
          )}
          <div data-tour="forms-preview">
            {invalid.length ? (
              <p className="rounded-lg border p-5 text-sm text-muted-foreground">
                {t("forms.data_fix_before_export")}
              </p>
            ) : (
              <PDFPreview input={preview} />
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
export function Forms() {
  useAppLanguage();
  const {
    draft,
    setDraft,
    legacy,
    failed: draftFailed,
    saveFailed,
    retry: retryDraft,
  } = useFormDraft();
  const [busy, setBusy] = useState(false);
  const [documents, setDocuments] = useState<HighTexDocument[]>([]);
  const [documentId, setDocumentId] = useState("");
  const [profile, setProfile] = useState<DocumentProfile>();
  const [profileFailed, setProfileFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    const refreshProfile = () => {
      setProfileFailed(false);
      void window.profile
        ?.get()
        .then((profile) => {
          if (active) setProfile(profile);
        })
        .catch(() => {
          if (active) setProfileFailed(true);
        });
    };
    refreshProfile();
    window.addEventListener("focus", refreshProfile);
    const offProfile = window.profile.onChange?.(refreshProfile);
    const offSession = window.session?.onChange?.(refreshProfile);
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
        setDocumentId((selected) =>
          docs.some((document) => document.id === selected) ? selected : "",
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
      offProfile?.();
      offSession?.();
    };
  }, [retry]);
  const document = documents.find((doc) => doc.id === documentId);
  const contexts = useMemo(() => {
    if (!draft) return;
    const intern = documents.find((doc) => doc.id === draft.values.internId);
    const resolve = (stage: FormStage): FormInputContext => {
      const source = documentFormData(document, intern, stage, profile);
      return {
        source,
        data: resolveFormData(source, formDraftData({ ...draft, stage })),
      };
    };
    return { proposal: resolve("proposal"), defense: resolve("defense") };
  }, [document, documents, draft, profile]);
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("workspace.tools")}
        title={t("forms.title")}
        description={t("forms.subtitle")}
      />
      {(draftFailed || saveFailed) && (
        <div role="alert" className="rounded-lg border p-3 text-sm space-y-2">
          <p>
            {t(
              draftFailed ? "forms.draft_load_failed" : "forms.storage_failed",
            )}
          </p>
          {draftFailed && (
            <Button variant="outline" onClick={retryDraft}>
              {t("forms.retry")}
            </Button>
          )}
        </div>
      )}
      {profileFailed && (
        <div role="alert" className="space-y-2 rounded-lg border p-3 text-sm">
          <p>{t("forms.profile_load_failed")}</p>
          <Button
            variant="outline"
            onClick={() => setRetry((value) => value + 1)}
          >
            {t("forms.retry")}
          </Button>
        </div>
      )}
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
      ) : (
        <>
          <div className="space-y-2">
            <label htmlFor="forms-document" className="text-xs font-medium">
              {t("forms.document")}
            </label>
            <NativeSelect
              id="forms-document"
              value={documentId}
              disabled={busy || documents.length === 0}
              onChange={(event) => setDocumentId(event.target.value)}
            >
              <option value="">
                {t(
                  documents.length
                    ? "forms.choose_document"
                    : "forms.document_empty",
                )}
              </option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {parseItalic(doc.title)
                    .map((part) => part.text)
                    .join("")}
                </option>
              ))}
            </NativeSelect>
          </div>
          {draft && contexts && profile && !profileFailed ? (
            <>
              <fieldset disabled={busy} className="min-w-0 space-y-5">
                <div
                  data-tour="forms-stage"
                  className="flex w-fit rounded-lg bg-muted/50 p-1"
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
                      {t(`forms.${stage}`)}
                    </Button>
                  ))}
                </div>
                <FormDraftRecovery
                  draft={draft}
                  legacy={legacy}
                  documents={documents}
                  onChange={setDraft}
                />
                <FormInputs
                  onReset={() =>
                    void (async () => {
                      if (
                        await confirm({
                          title: t("forms.reset_confirm"),
                          desc: t("forms.reset_hint"),
                        })
                      )
                        setDraft((state) => ({
                          ...emptyWorkspaceFormDraft(),
                          stage: state.stage,
                        }));
                    })()
                  }
                  contexts={contexts}
                  stage={draft.stage}
                  documents={documents}
                  selectedDocument={document}
                  internId={draft.values.internId ?? ""}
                  onInternChange={(internId) =>
                    setDraft((state) => ({
                      ...state,
                      values: { ...state.values, internId },
                      conflicts: state.conflicts.filter(
                        (conflict) => conflict.field !== "internId",
                      ),
                    }))
                  }
                  onChange={(stage, next) =>
                    setDraft((state) => ({
                      ...updateFormDraft(
                        { ...state, stage },
                        contexts[stage].data,
                        next,
                      ),
                      stage: state.stage,
                    }))
                  }
                />
              </fieldset>
              <section id="forms-output" className="scroll-mt-5 space-y-4">
                <h2 className="text-base font-semibold">
                  {t("forms.data_output_title")}
                </h2>
                {document ? (
                  <FormWorkspace
                    document={document}
                    context={contexts[draft.stage]}
                    draft={draft}
                    setDraft={setDraft}
                    busy={busy}
                    setBusy={setBusy}
                  />
                ) : (
                  <div
                    data-tour="forms-empty"
                    className="space-y-3 rounded-xl border p-6 text-center"
                  >
                    <FileStack className="mx-auto size-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {t(
                        documents.length
                          ? "forms.start_hint"
                          : "forms.no_documents",
                      )}
                    </p>
                    {!documents.length && (
                      <Button asChild variant="outline" size="sm">
                        <Link to="/dashboard">
                          {t("forms.browse_documents")}
                        </Link>
                      </Button>
                    )}
                  </div>
                )}
              </section>
            </>
          ) : !profile && !profileFailed ? (
            <p role="status">{t("settings.profile.loading")}</p>
          ) : null}
        </>
      )}
    </div>
  );
}
