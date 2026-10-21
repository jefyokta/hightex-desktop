import { useEffect, useRef, useState } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { useOnline } from "@/hooks/use-online";
import { HighTexDB } from "@/editor/storage/hightex-db";
import {
  accountProfilePatch,
  applyAccountProfile,
  type AccountField,
} from "@/account/apply-profile";
import { sanitizeCvHtml } from "@/utils/sanitize-cv-html";
import { toWebPBlob } from "@/utils/images-to-webp";
import { confirm } from "@/utils/confirm";
import { t } from "@/utils/lang";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { LoginGate } from "./login-gate";

export const AccountProfile = () => {
  const { user } = useUser();
  const online = useOnline();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("account_profile.title")}</CardTitle>
        <CardDescription>{t("account_profile.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {!user ? (
          <LoginGate />
        ) : !online ? (
          <p className="text-sm text-muted-foreground">
            {t("submission_review.offline")}
          </p>
        ) : (
          <AccountProfileForm key={user.id} />
        )}
      </CardContent>
    </Card>
  );
};
const AccountProfileForm = () => {
  const [data, setData] = useState<AccountProfileData>();
  const [cv, setCv] = useState("");
  const [photo, setPhoto] = useState<File>();
  const [serverPhoto, setServerPhoto] = useState<Blob>();
  const [photoUrl, setPhotoUrl] = useState("");
  const [docs, setDocs] = useState<HighTexDocument[]>([]);
  const [documentId, setDocumentId] = useState("");
  const [fields, setFields] = useState<AccountField[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [notice, setNotice] = useState<string>();
  const content = useRef<HTMLDivElement>(null);
  const operation = useRef(false);
  const alive = useRef(true);
  const loadVersion = useRef(0);
  const showError = (code: string) => {
    const known = [
      "session_changed",
      "not_authenticated",
      "forbidden",
      "invalid_response",
      "request_failed",
      "invalid_image",
      "validation",
      "outcome_unknown",
      "busy",
      "cloud_locked",
      "editor_open",
      "document_changed",
    ] as const;
    setError(
      t(
        `account_profile.errors.${known.find((value) => value === code) ?? "request_failed"}`,
      ),
    );
  };
  const accept = (next: AccountProfileData) => {
    setData(next);
    setCv(next.cv ?? "");
    setPhoto(undefined);
    setFields([]);
    if (content.current)
      content.current.innerHTML = sanitizeCvHtml(next.cv ?? "");
  };
  const load = async () => {
    const version = ++loadVersion.current;
    const response = await window.account.load();
    if (!alive.current || version !== loadVersion.current) return;
    if (!response.ok) {
      setData(undefined);
      showError(response.error);
      return;
    }
    accept(response.data);
    const [picture, local] = await Promise.all([
      window.account.picture(response.data.session.sessionId),
      HighTexDB.getInstance().documents.toArray(),
    ]);
    if (!alive.current || version !== loadVersion.current) return;
    if (picture.ok)
      setServerPhoto(
        picture.data
          ? new Blob([picture.data.bytes.slice().buffer], {
              type: picture.data.type,
            })
          : undefined,
      );
    else {
      setServerPhoto(undefined);
      showError(picture.error);
    }
    setDocs(local);
  };
  useEffect(() => {
    alive.current = true;
    const version = loadVersion.current + 1;
    void load()
      .catch(() => {
        if (alive.current) showError("request_failed");
      })
      .finally(() => {
        if (alive.current && version === loadVersion.current) setBusy(false);
      });
    return () => {
      alive.current = false;
      loadVersion.current += 1;
    };
    // The form is mounted per account and refreshed explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (content.current && data)
      content.current.innerHTML = sanitizeCvHtml(data.cv ?? "");
  }, [data]);
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
  const current = async () => {
    const session = await window.hightex.submission.context();
    if (
      !alive.current ||
      !session.ok ||
      session.data.sessionId !== data?.session.sessionId
    )
      throw Error("session_changed");
  };
  const run = async (action: () => Promise<void>) => {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    setFieldErrors({});
    try {
      await action();
    } catch (cause) {
      if (alive.current)
        showError(cause instanceof Error ? cause.message : "request_failed");
    } finally {
      operation.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const save = () =>
    run(async () => {
      if (!data) return;
      await current();
      const response = await window.account.update({
        sessionId: data.session.sessionId,
        ...(cv !== (data.cv ?? "") ? { cv } : {}),
        ...(photo
          ? {
              image: {
                bytes: new Uint8Array(await photo.arrayBuffer()),
                type: photo.type,
                name: photo.name,
              },
            }
          : {}),
      });
      if (!alive.current) return;
      if (!response.ok) {
        showError(response.error);
        setFieldErrors(response.fields ?? {});
        return;
      }
      accept(response.data);
      const picture = await window.account.picture(
        response.data.session.sessionId,
      );
      if (!alive.current) return;
      if (picture.ok)
        setServerPhoto(
          picture.data
            ? new Blob([picture.data.bytes.slice().buffer], {
                type: picture.data.type,
              })
            : undefined,
        );
      else showError(picture.error);
      setNotice(t("account_profile.saved"));
    });
  const apply = () =>
    run(async () => {
      if (!data || !documentId || !fields.length) return;
      await current();
      const db = HighTexDB.getInstance();
      const before = await db.documents.get(documentId);
      if (!before) throw Error("document_changed");
      const picture =
        fields.includes("picture") && serverPhoto
          ? await toWebPBlob(new File([serverPhoto], "profile"))
          : undefined;
      const patch = accountProfilePatch(
        { ...data, cv: data.cv === null ? null : sanitizeCvHtml(data.cv) },
        fields,
        picture,
      );
      if (
        !(await confirm({
          title: t("account_profile.apply_confirm"),
          desc: t("account_profile.apply_description", { title: before.title }),
        }))
      )
        return;
      await applyAccountProfile(db, before, patch, {
        current,
        isCurrent: () => alive.current,
        locked: (id) => window.hightex.cloud.academic.locked(id),
        editor: (id) => window.editor.has(id),
      });
      if (!alive.current) return;
      setDocs(await db.documents.toArray());
      setNotice(t("account_profile.applied"));
    });
  const selected = docs.find((doc) => doc.id === documentId);
  const plain = (value?: string | null) => {
    const node = new DOMParser().parseFromString(
      sanitizeCvHtml(value ?? ""),
      "text/html",
    );
    return node.body.textContent?.slice(0, 240) || t("account_profile.empty");
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {data ? `${data.name} · ${data.email}` : t("account_profile.loading")}
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              if (
                (photo || cv !== (data?.cv ?? "")) &&
                !(await confirm({ title: t("account_profile.reload_confirm") }))
              )
                return;
              await load();
            })
          }
        >
          <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} />
          {t("submission_review.refresh")}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}
      {data && (
        <>
          <p className="text-xs text-muted-foreground">
            {data.roles.join(", ") || t("account_profile.no_roles")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("account_profile.identity")}:{" "}
            {data.nim ?? t("account_profile.unavailable")}
            {data.shortname ? ` · ${data.shortname}` : ""}
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const response = await window.account.settings(
                  data.session.sessionId,
                );
                if (!response.ok) showError(response.error);
              })
            }
          >
            {t("account_profile.web_settings")}
          </Button>
          <div className="space-y-2">
            <label htmlFor="account-image" className="text-sm font-medium">
              {t("account_profile.picture")}
            </label>
            {photoUrl && (
              <img
                src={photoUrl}
                alt={t("account_profile.picture")}
                className="size-24 rounded-xl object-cover"
              />
            )}
            <Input
              id="account-image"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                if (
                  file.size > 2 * 1024 * 1024 ||
                  !["image/png", "image/jpeg", "image/webp"].includes(file.type)
                ) {
                  setPhoto(undefined);
                  showError("invalid_image");
                  return;
                }
                setPhoto(file);
              }}
            />
            <p className="text-xs text-muted-foreground">
              {t("account_profile.picture_hint")}
            </p>
            {fieldErrors.image?.map((message, index) => (
              <p key={index} className="text-xs text-destructive">
                {message}
              </p>
            ))}
            {photo && (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => setPhoto(undefined)}
              >
                {t("account_profile.cancel_picture")}
              </Button>
            )}
          </div>
          <div className="space-y-2">
            <label id="account-cv-label" className="text-sm font-medium">
              CV
            </label>
            <div
              ref={content}
              role="textbox"
              aria-labelledby="account-cv-label"
              contentEditable={!busy}
              suppressContentEditableWarning
              className="min-h-32 rounded-xl border bg-background p-3 text-sm"
              onInput={(event) =>
                setCv(
                  event.currentTarget.textContent?.trim()
                    ? sanitizeCvHtml(event.currentTarget.innerHTML)
                    : "",
                )
              }
              onPaste={(event) => {
                event.preventDefault();
                document.execCommand(
                  "insertText",
                  false,
                  event.clipboardData.getData("text/plain"),
                );
              }}
              onDrop={(event) => event.preventDefault()}
            />
            {fieldErrors.cv?.map((message, index) => (
              <p key={index} className="text-xs text-destructive">
                {message}
              </p>
            ))}
          </div>
          {fieldErrors.profile?.map((message, index) => (
            <p key={index} className="text-xs text-destructive">
              {message}
            </p>
          ))}
          <Button
            size="sm"
            disabled={busy || (!photo && cv === (data.cv ?? ""))}
            onClick={() => void save()}
          >
            {busy && <LoaderCircle className="size-4 animate-spin" />}
            {t("account_profile.save")}
          </Button>
          <div className="rounded-xl border p-4 space-y-3">
            <h3 className="text-sm font-medium">
              {t("account_profile.apply")}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t("account_profile.apply_hint")}
            </p>
            <Select
              value={documentId}
              disabled={busy}
              onValueChange={setDocumentId}
            >
              <SelectTrigger
                className="w-full"
                aria-label={t("account_profile.document")}
              >
                <SelectValue placeholder={t("account_profile.document")} />
              </SelectTrigger>
              <SelectContent>
                {docs.map((doc) => (
                  <SelectItem key={doc.id} value={doc.id}>
                    {doc.title || t("common.untitled_document")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected && (
              <div className="space-y-2">
                {(["name", "nim", "cv", "picture"] as const).map((field) => {
                  const next =
                    field === "picture"
                      ? serverPhoto
                      : field === "name"
                        ? data.name
                        : data[field];
                  const available = next !== null && next !== undefined;
                  return (
                    <label
                      key={field}
                      className="flex items-start gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={fields.includes(field)}
                        disabled={busy || !available}
                        onChange={(event) =>
                          setFields((previous) =>
                            event.target.checked
                              ? [...previous, field]
                              : previous.filter((item) => item !== field),
                          )
                        }
                      />
                      <span>
                        {t(`account_profile.fields.${field}`)}
                        <span className="block text-xs text-muted-foreground">
                          {field === "picture"
                            ? `${selected.profile?.picture ? t("account_profile.recorded") : t("account_profile.empty")} → ${available ? t("account_profile.recorded") : t("account_profile.unavailable")}`
                            : `${plain(selected.profile?.[field])} → ${available ? plain(String(next)) : t("account_profile.unavailable")}`}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={
                busy ||
                !selected ||
                !fields.length ||
                Boolean(photo) ||
                cv !== (data.cv ?? "")
              }
              onClick={() => void apply()}
            >
              {t("account_profile.apply")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
