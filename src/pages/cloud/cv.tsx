import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, RefreshCw, Save } from "lucide-react";
import { LoginGate } from "@/components/login-gate";
import { ProfileCVPage } from "@/components/profile-cv-page";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useOnline } from "@/hooks/use-online";
import { useUser } from "@/hooks/use-user";
import { confirm } from "@/utils/confirm";
import { t } from "@/utils/lang";
import { sanitizeCvHtml } from "@/utils/sanitize-cv-html";
import { toWebPBlob } from "@/utils/images-to-webp";
import { useWorkspaces } from "@/hooks/use-workspaces";

type AccountError = Extract<AccountResult<never>, { ok: false }>;
type IsCurrent = () => boolean;

type DraftCallbacks = {
    onDirtyChange?: (dirty: boolean) => void;
    onBusyChange?: (busy: boolean) => void;
};
export const CloudCVEditor = (callbacks: DraftCallbacks = {}) => {
    const { state } = useWorkspaces();
    const local =
        !state ||
        state.profiles.find((profile) => profile.id === state.activeId)
            ?.type === "local";
    if (local) return null;
    return <CloudCVForm key={state?.activeId} {...callbacks} />;
};

const CloudCVForm = ({ onDirtyChange, onBusyChange }: DraftCallbacks) => {
    const { user } = useUser();
    const userId = user ? String(user.id) : undefined;
    const online = useOnline();
    const [cached, setCached] = useState<Pick<
        Profile,
        "name" | "nim" | "cv"
    > | null>();
    const [cachedPicture, setCachedPicture] = useState<Blob>();
    const [cacheFailed, setCacheFailed] = useState(false);
    const [data, setData] = useState<AccountProfileData>();
    const [cv, setCv] = useState("");
    const [photo, setPhoto] = useState<File>();
    const [serverPhoto, setServerPhoto] = useState<Blob>();
    const [busy, setBusy] = useState(true);
    const [error, setError] = useState<AccountError["error"]>();
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>(
        {},
    );
    const [notice, setNotice] = useState<string>();
    const [reloadError, setReloadError] = useState<AccountError["error"]>();
    const operation = useRef(false);
    const revision = useRef(0);
    const dirty = Boolean(photo) || Boolean(data && cv !== (data.cv ?? ""));
    const draftDirty = useRef(dirty);
    draftDirty.current = dirty;
    const editable =
        Boolean(data && userId && data.session.accountId === userId) &&
        online &&
        !busy &&
        !reloadError;
    const displayedError = error ?? reloadError;
    useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
    useEffect(() => onBusyChange?.(busy && dirty), [busy, dirty, onBusyChange]);

    const loadCache = useCallback(async (current: IsCurrent) => {
        try {
            const [profile, bytes] = await Promise.all([
                window.profile.cachedCloud(),
                window.profile.picture(),
            ]);
            if (!current()) return;
            setCached(
                profile ? { ...profile, cv: sanitizeCvHtml(profile.cv) } : null,
            );
            setCachedPicture(
                bytes
                    ? new Blob([bytes.slice().buffer], { type: "image/webp" })
                    : undefined,
            );
            setCacheFailed(false);
        } catch {
            if (current()) setCacheFailed(true);
        }
    }, []);

    const accept = useCallback((profile: AccountProfileData) => {
        const html = sanitizeCvHtml(profile.cv ?? "");
        setData({ ...profile, cv: html });
        setCv(html);
        setPhoto(undefined);
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
        async (current: IsCurrent, preserveDraft = false) => {
            const response = await window.account.load();
            if (!current()) return;
            if (!response.ok) {
                showError(response);
                return;
            }
            if (preserveDraft)
                setData({
                    ...response.data,
                    cv: sanitizeCvHtml(response.data.cv ?? ""),
                });
            else accept(response.data);
            setReloadError(undefined);
            setServerPhoto(undefined);
            await loadPicture(response.data.session.sessionId, current);
        },
        [accept, loadPicture, showError],
    );

    useEffect(() => {
        let alive = true;
        void loadCache(() => alive);
        return () => {
            alive = false;
        };
    }, [loadCache]);

    useEffect(() => {
        if (online && userId)
            void run((current) => load(current, draftDirty.current));
        else if (!operation.current) setBusy(false);
    }, [online, userId, run, load]);

    useEffect(() => {
        return () => {
            revision.current += 1;
            operation.current = false;
        };
    }, []);

    const save = () =>
        run(async (current) => {
            if (!data || !userId || !dirty || !online || reloadError) return;
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
        <Card>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
                <div className="space-y-1.5">
                    <CardTitle>{t("cloud_cv.title")}</CardTitle>
                    <CardDescription>
                        {t("cloud_cv.description")}
                    </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                            void run(async (current) => {
                                if (
                                    dirty &&
                                    !(await confirm({
                                        title: t(
                                            "account_profile.reload_confirm",
                                        ),
                                    }))
                                )
                                    return;
                                if (current()) {
                                    await loadCache(current);
                                    if (online && userId) await load(current);
                                }
                            })
                        }
                    >
                        <RefreshCw className="size-4" />
                        {t("submission_review.refresh")}
                    </Button>
                    <Button
                        disabled={!editable || !dirty}
                        onClick={() => void save()}
                    >
                        {busy ? (
                            <LoaderCircle className="size-4 animate-spin" />
                        ) : (
                            <Save className="size-4" />
                        )}
                        {t("account_profile.save")}
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                    {(!data || !online || !userId || reloadError) && (
                        <p role="status" className="text-muted-foreground">
                            {t(
                                dirty
                                    ? "profile.draft_retained"
                                    : "profile.cached",
                            )}
                        </p>
                    )}
                    {cacheFailed && (
                        <p role="alert" className="text-destructive">
                            {t("profile.cache_failed")}
                        </p>
                    )}
                    {!data && cached === null && (
                        <p role="status">{t("profile.cache_empty")}</p>
                    )}
                    {!data && cached && (
                        <p>
                            {cached.name} · {cached.nim}
                        </p>
                    )}
                    {online && !userId && <LoginGate compact />}
                    {busy && (
                        <p role="status">{t("account_profile.loading")}</p>
                    )}
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
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="text-muted-foreground">
                                <p>
                                    {data.name} · {data.email}
                                </p>
                                <p className="mt-1 text-xs">
                                    {t("account_profile.identity")}:{" "}
                                    {data.nim ??
                                        t("account_profile.unavailable")}
                                    {data.roles.length
                                        ? ` · ${data.roles.join(", ")}`
                                        : ` · ${t("account_profile.no_roles")}`}
                                </p>
                            </div>
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={busy || !online || !userId}
                                onClick={() =>
                                    void run(async (current) => {
                                        const response =
                                            await window.account.settings(
                                                data.session.sessionId,
                                            );
                                        if (current() && !response.ok)
                                            showError(response);
                                    })
                                }
                            >
                                {t("account_profile.web_settings")}
                            </Button>
                        </div>
                    )}
                    <p id="cloud-cv-hint" className="text-muted-foreground">
                        {editable ? (
                            <>
                                {t("cloud_cv.hint")}{" "}
                                {t("cloud_cv.picture_hint")}
                            </>
                        ) : (
                            t("document_profile.cv_description")
                        )}
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
                <ProfileCVPage
                    id="cloud-cv"
                    value={data ? cv : (cached?.cv ?? "")}
                    picture={
                        photo ??
                        serverPhoto ??
                        (!data ? cachedPicture : undefined)
                    }
                    editable={editable}
                    busy={busy}
                    invalid={Boolean(fieldErrors.cv?.length)}
                    describedBy="cloud-cv-hint"
                    onChange={(value) => {
                        setCv(value);
                        setNotice(undefined);
                    }}
                    onPictureChange={(file) => {
                        void run(async (current) => {
                            try {
                                const maxBytes = 2 * 1024 * 1024;
                                const image = await toWebPBlob(file, {
                                    maxBytes,
                                });
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
            </CardContent>
        </Card>
    );
};
