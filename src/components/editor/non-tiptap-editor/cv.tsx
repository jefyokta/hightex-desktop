import { Paper } from "@/components/paper";
import { ShouldNotified } from "@/exception/interfaces/should-notified";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toWebPBlob } from "@/utils/images-to-webp";
import { useParams } from "react-router-dom";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { resolveDocumentProfile } from "@/utils/document-profile";
import { sanitizeCvHtml } from "@/utils/sanitize-cv-html";
import { t } from "@/utils/lang";
import { confirm } from "@/utils/confirm";

export const Cv = () => {
  const { id } = useParams();
  const [showNotice, setShowNotice] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [picture, setPicture] = useState<Blob>();
  const [pictureUrl, setPictureUrl] = useState("");

  const contentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const documentIdRef = useRef(id);
  documentIdRef.current = id;

  useEffect(() => {
    let mounted = true;
    setLoaded(false);
    setPicture(undefined);
    if (contentRef.current) contentRef.current.innerHTML = "";
    const load = async () => {
      if (!id) return;
      const document = await HighTexDB.getInstance().documents.get(id);
      if (!document || !mounted) return;
      const profile = resolveDocumentProfile(document);
      if (contentRef.current)
        contentRef.current.innerHTML = sanitizeCvHtml(profile.cv);
      setPicture(profile.picture);
      setLoaded(true);
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [id]);

  useEffect(() => {
    if (!picture) {
      setPictureUrl("");
      return;
    }
    const url = URL.createObjectURL(picture);
    setPictureUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [picture]);

  const dismissNotice = () => setShowNotice(false);

  const handleInput = async (event: React.FormEvent<HTMLDivElement>) => {
    if (!id || !loaded) return;
    await HighTexDB.getInstance().updateProfile(id, {
      cv: sanitizeCvHtml(event.currentTarget.innerHTML),
    });
  };

  const openPicturePicker = () => {
    if (loaded) inputRef.current?.click();
  };

  const handlePictureChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      throw new ShouldNotified({
        message: "Invalid profile picture",
        description: "Please select an image file.",
      });
    }

    if (!id || !loaded) return;
    const picture = await toWebPBlob(file);
    await HighTexDB.getInstance().updateProfile(id, { picture });
    if (documentIdRef.current !== id) return;
    setPicture(picture);

    event.target.value = "";
  };

  const useDefaultCv = async () => {
    if (!id || !loaded) return;
    const [profile, bytes] = await Promise.all([
      window.profile.get(),
      window.profile.picture(),
    ]);
    if (!profile.cv && !bytes)
      throw new ShouldNotified(t("document_profile.default_cv_empty"));
    if (
      !(await confirm({
        title: t("document_profile.copy_default_cv_confirm"),
        desc: t("document_profile.copy_default_cv_description"),
      })) ||
      documentIdRef.current !== id
    )
      return;

    const picture = bytes
      ? new Blob([new Uint8Array(bytes)], { type: "image/webp" })
      : undefined;
    const cv = sanitizeCvHtml(profile.cv);
    await HighTexDB.getInstance().updateProfile(id, { cv, picture });
    if (documentIdRef.current !== id) return;
    if (contentRef.current) contentRef.current.innerHTML = cv;
    setPicture(picture);
  };

  return (
    <>
      {showNotice && (
        <Alert className="my-2 w-[21cm] border-amber-200/80 bg-amber-50/70 p-4 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100">
          <Info className="text-amber-600 dark:text-amber-400" />

          <AlertTitle className="text-amber-900 dark:text-amber-100">
            {t("document_profile.cv_title")}
          </AlertTitle>

          <AlertDescription className="text-amber-800/80 dark:text-amber-200/80">
            {t("document_profile.cv_description")}
            <Button
              size="sm"
              variant="outline"
              disabled={!loaded}
              onClick={useDefaultCv}
            >
              {t("document_profile.copy_default_cv")}
            </Button>
          </AlertDescription>

          <AlertAction>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-amber-700 hover:bg-amber-100 hover:text-amber-900 dark:text-amber-300 dark:hover:bg-amber-900/40 dark:hover:text-amber-100"
              onClick={dismissNotice}
            >
              <span aria-hidden="true">×</span>
              <span className="sr-only">Dismiss notification</span>
            </Button>
          </AlertAction>
        </Alert>
      )}

      <Paper strictHeight={true} className="text-justify">
        <div className="w-full h-full border">
          <h1 className="text-[14pt] font-bold text-center mb-[16pt]">
            DAFTAR RIWAYAT HIDUP
          </h1>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePictureChange}
          />

          <div
            onClick={openPicturePicker}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openPicturePicker();
              }
            }}
            style={{
              fontFamily: '"Geist Variable", sans-serif',
            }}
            className="float-left flex w-[3cm] h-[4cm] mr-[10pt] mb-[5pt] cursor-pointer items-center justify-center border border-dashed text-center text-xs text-muted-foreground transition hover:bg-muted/50"
          >
            {pictureUrl ? (
              <img
                src={pictureUrl}
                alt={t("document_profile.picture")}
                className="w-full h-full object-cover"
              />
            ) : (
              <div>
                <span>{t("document_profile.picture")}</span>
                <br />
                <b>3×4</b>
              </div>
            )}
          </div>

          <div
            ref={contentRef}
            contentEditable={loaded}
            suppressContentEditableWarning
            className="outline-0"
            onKeyDown={(event) => {
              if (event.key !== "Enter") {
                return;
              }

              event.preventDefault();

              throw new ShouldNotified({
                message: "Cannot create a new paragraph",
                description:
                  "The Curriculum Vitae content must be written as a single paragraph.",
              });
            }}
            onPaste={(event) => {
              event.preventDefault();
              window.document.execCommand(
                "insertText",
                false,
                event.clipboardData.getData("text/plain"),
              );
            }}
            onInput={handleInput}
          />
        </div>
      </Paper>
    </>
  );
};
