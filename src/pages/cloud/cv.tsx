import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, RefreshCw, Save } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { LoginGate } from "@/components/login-gate";
import { Paper } from "@/components/paper";
import { Button } from "@/components/ui/button";
import { useOnline } from "@/hooks/use-online";
import { useUser } from "@/hooks/use-user";
import { confirm } from "@/utils/confirm";
import { t } from "@/utils/lang";
import { sanitizeCvHtml } from "@/utils/sanitize-cv-html";
import { toWebPBlob } from "@/utils/images-to-webp";

type AccountError = Extract<AccountResult<never>, { ok: false }>;
type IsCurrent = () => boolean;

export const CloudCVEditor = () => {
    const { user } = useUser();
    if (!user) return <LoginGate />;
    return <CloudCVForm key={user.id} />;
};

const CloudCVForm = () => {
    const online = useOnline();
    const [data, setData] = useState<AccountProfileData>();
    const [cv, setCv] = useState("");
    const [photo, setPhoto] = useState<File>();
    const [serverPhoto, setServerPhoto] = useState<Blob>();
    const [photoUrl, setPhotoUrl] = useState("");
    const [busy, setBusy] = useState(true);
    const [error, setError] = useState<AccountError["error"]>();
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
    const [notice, setNotice] = useState<string>();
    const [reloadError, setReloadError] = useState<AccountError["error"]>();
    const contentRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const operation = useRef(false);
    const revision = useRef(0);
    const dirty = Boolean(photo) || cv !== (data?.cv ?? "");
    const editable = Boolean(data) && !busy && !reloadError;
    const displayedError = error ?? reloadError;

    const accept = useCallback((profile: AccountProfileData) => {
        const html = sanitizeCvHtml(profile.cv ?? "");
        setData({ ...profile, cv: html });
        setCv(html);
        setPhoto(undefined);
        if (contentRef.current) contentRef.current.innerHTML = html;
    }, []);

    const showError = useCallback((response: AccountError) => {
        setError(response.error);
        setFieldErrors(response.fields ?? {});
        if (
            response.error === "outcome_unknown" ||
            response.error === "session_changed" ||
            response.error === "not_authenticated"
        )
            setReloadError(response.error);
    }, []);

    const run = useCallback(
        async (action: (current: IsCurrent) => Promise<void>) => {
            if (operation.current) return;
            operation.current = true;
            const version = ++revision.current;
            const current = () => revision.current === version;
            setBusy(true);
            setError(undefined);
            setNotice(undefined);
            setFieldErrors({});
            try {
                await action(current);
            } catch {
                if (current()) setError("request_failed");
            } finally {
                if (current()) {
                    operation.current = false;
                    setBusy(false);
                }
            }
        },
        [],
    );

    const loadPicture = useCallback(
        async (sessionId: string, current: IsCurrent) => {
            const response = await window.account.picture(sessionId);

            if (!current()) return;
            if (!response.ok) {
                showError(response);
                return;
            }
            setServerPhoto(
                response.data
                    ? new Blob([response.data.bytes.slice().buffer], {
                        type: response.data.type,
                    })
                    : undefined,
            );
        },
        [showError],
    );

    const load = useCallback(
        async (current: IsCurrent) => {
            const response = await window.account.load();
            if (!current()) return;
            if (!response.ok) {
                showError(response);
                return;
            }
            accept(response.data);
            setReloadError(undefined);
            setServerPhoto(undefined);
            await loadPicture(response.data.session.sessionId, current);
        },
        [accept, loadPicture, showError],
    );

    useEffect(() => {
        if (navigator.onLine) void run(load);
        else setBusy(false);
        return () => {
            revision.current += 1;
            operation.current = false;
        };
    }, [load, run]);

    useEffect(() => {
        const image = photo ?? serverPhoto;
        if (!image) {
            setPhotoUrl("");
            return;
        }
        const url = URL.createObjectURL(image);
        setPhotoUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [photo, serverPhoto]);

    const save = () =>
        run(async (current) => {
            if (!data || !dirty || !online || reloadError) return;
            const image = photo
                ? {
                    bytes: new Uint8Array(await photo.arrayBuffer()),
                    type: photo.type,
                    name: photo.name,
                }
                : undefined;
            if (!current()) return;
            const response = await window.account.update({
                sessionId: data.session.sessionId,
                ...(cv !== (data.cv ?? "") ? { cv: sanitizeCvHtml(cv) } : {}),
                ...(image ? { image } : {}),
            });
            if (!current()) return;
            if (!response.ok) {
                showError(response);
                return;
            }
            if (photo) setServerPhoto(photo);
            accept(response.data);
            setNotice(t("account_profile.saved"));
            await loadPicture(response.data.session.sessionId, current);
        });

    return (
        <>
            <PageHeader
                title={t("cloud_cv.title")}
                description={t("cloud_cv.description")}
                actions={
                    <>
                        <Button
                            variant="outline"
                            disabled={busy || !online}
                            onClick={() =>
                                void run(async (current) => {
                                    if (
                                        dirty &&
                                        !(await confirm({
                                            title: t("account_profile.reload_confirm"),
                                        }))
                                    )
                                        return;
                                    if (current()) await load(current);
                                })
                            }
                        >
                            <RefreshCw className="size-4" />
                            {t("submission_review.refresh")}
                        </Button>
                        <Button
                            disabled={!editable || !online || !dirty}
                            onClick={() => void save()}
                        >
                            {busy ? (
                                <LoaderCircle className="size-4 animate-spin" />
                            ) : (
                                <Save className="size-4" />
                            )}
                            {t("account_profile.save")}
                        </Button>
                    </>
                }
            />
            <div className="space-y-2 text-sm">
                {!online && <p role="status">{t("cloud_cv.offline")}</p>}
                {busy && <p role="status">{t("account_profile.loading")}</p>}
                {displayedError && (
                    <p role="alert" className="text-destructive">
                        {displayedError === "invalid_image"
                            ? t("cloud_cv.invalid_image")
                            : t(`account_profile.errors.${displayedError}`)}
                    </p>
                )}
                {Object.entries(fieldErrors).flatMap(([field, messages]) =>
                    messages.map((message, index) => (
                        <p
                            key={`${field}-${index}`}
                            role="alert"
                            className="text-destructive"
                        >
                            {message}
                        </p>
                    )),
                )}
                {notice && <p role="status">{notice}</p>}
                {data && (
                    <p className="text-muted-foreground">
                        {data.name} · {data.email}
                    </p>
                )}
                <p id="cloud-cv-hint" className="text-muted-foreground">
                    {t("cloud_cv.hint")} {t("cloud_cv.picture_hint")}
                </p>
                {photo && (
                    <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => setPhoto(undefined)}
                    >
                        {t("account_profile.cancel_picture")}
                    </Button>
                )}
            </div>
            <div className="overflow-x-auto pb-4">
                <Paper strictHeight className="text-justify" aria-busy={busy}>
                    <h2
                        id="cloud-cv-label"
                        className="mb-[16pt] text-center text-[14pt] font-bold"
                    >
                        DAFTAR RIWAYAT HIDUP
                    </h2>
                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/*"
                        aria-label={t("account_profile.picture")}
                        className="hidden"
                        disabled={!editable}
                        onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.target.value = "";
                            if (!file || !editable) return;
                            void run(async (current) => {
                                try {
                                    const maxBytes = 2 * 1024 * 1024;
                                    const image = await toWebPBlob(file, { maxBytes });
                                    if (!current()) return;
                                    if (
                                        !image.size ||
                                        image.size > maxBytes ||
                                        image.type !== "image/webp"
                                    ) {
                                        setError("invalid_image");
                                        return;
                                    }
                                    setPhoto(
                                        new File(
                                            [image],
                                            `${file.name.replace(/\.[^/.]+$/, "")}.webp`,
                                            {
                                                type: image.type,
                                                lastModified: file.lastModified,
                                            },
                                        ),
                                    );
                                } catch {
                                    if (current()) setError("invalid_image");
                                }
                            });
                        }}
                    />
                    <button
                        type="button"
                        disabled={!editable}
                        onClick={() => inputRef.current?.click()}
                        aria-label={t("account_profile.picture")}
                        aria-describedby="cloud-cv-hint"
                        style={{ fontFamily: '"Geist Variable", sans-serif' }}
                        className="float-left mb-[5pt] mr-[10pt] flex h-[4cm] w-[3cm] items-center justify-center border border-dashed text-center text-xs text-muted-foreground transition enabled:cursor-pointer enabled:hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 disabled:opacity-50"
                    >
                        {photoUrl ? (
                            <img
                                src={photoUrl}
                                alt={t("account_profile.picture")}
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <span>
                                {t("account_profile.picture")}
                                <br />
                                <b>3×4</b>
                            </span>
                        )}
                    </button>
                    <div
                        ref={contentRef}
                        role="textbox"
                        aria-labelledby="cloud-cv-label"
                        aria-describedby="cloud-cv-hint"
                        aria-readonly={!editable}
                        aria-invalid={Boolean(fieldErrors.cv?.length)}
                        contentEditable={editable}
                        suppressContentEditableWarning
                        className="min-h-[4cm] outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                        onInput={(event) => {
                            setCv(
                                event.currentTarget.textContent?.trim()
                                    ? sanitizeCvHtml(event.currentTarget.innerHTML)
                                    : "",
                            );
                            setNotice(undefined);
                        }}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") event.preventDefault();
                        }}
                        onPaste={(event) => {
                            event.preventDefault();
                            document.execCommand(
                                "insertText",
                                false,
                                event.clipboardData
                                    .getData("text/plain")
                                    .replace(/\r?\n/g, " "),
                            );
                        }}
                        onDrop={(event) => event.preventDefault()}
                    />
                </Paper>
            </div>
        </>
    );
};
