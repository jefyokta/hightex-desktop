import { useEffect, useRef, useState } from "react";
import { Paper } from "@/components/paper";
import { sanitizeCvHtml } from "@/utils/sanitize-cv-html";
import { t } from "@/utils/lang";

export function ProfileCVPage({
  id,
  value,
  picture,
  editable = false,
  busy = false,
  invalid = false,
  describedBy,
  onChange,
  onPictureChange,
}: {
  id: string;
  value: string;
  picture?: Blob;
  editable?: boolean;
  busy?: boolean;
  invalid?: boolean;
  describedBy?: string;
  onChange?(html: string): void;
  onPictureChange?(file: File): void;
}) {
  const content = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [pictureUrl, setPictureUrl] = useState("");
  useEffect(() => {
    const html = sanitizeCvHtml(value);
    if (content.current && content.current.innerHTML !== html)
      content.current.innerHTML = html;
  }, [value]);
  useEffect(() => {
    if (!picture) {
      setPictureUrl("");
      return;
    }
    const url = URL.createObjectURL(picture);
    setPictureUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [picture]);
  const photo = pictureUrl ? (
    <img
      src={pictureUrl}
      alt={t("document_profile.picture")}
      className="h-full w-full object-cover"
    />
  ) : (
    <span>
      {t("document_profile.picture")}
      <br />
      <b>3×4</b>
    </span>
  );
  const photoClass =
    "float-left mb-[5pt] mr-[10pt] flex h-[4cm] w-[3cm] items-center justify-center border border-dashed text-center text-xs text-muted-foreground";
  return (
    <div
      data-profile-cv-page
      className="overflow-x-auto rounded-xl border bg-[#f1f3f5] p-4 sm:p-6 dark:bg-muted/20"
    >
      <Paper strictHeight className="mx-auto text-justify" aria-busy={busy}>
        <h2
          id={`${id}-label`}
          className="mb-[16pt] text-center text-[14pt] font-bold"
        >
          DAFTAR RIWAYAT HIDUP
        </h2>
        {onPictureChange ? (
          <>
            <input
              ref={input}
              type="file"
              accept="image/*"
              className="hidden"
              aria-label={t("document_profile.picture")}
              disabled={!editable || busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file && editable && !busy) onPictureChange(file);
              }}
            />
            <button
              type="button"
              className={`${photoClass} enabled:cursor-pointer enabled:hover:bg-muted/50 focus-visible:outline focus-visible:outline-2`}
              style={{ fontFamily: '"Geist Variable", sans-serif' }}
              disabled={!editable || busy}
              aria-label={t("document_profile.picture")}
              aria-describedby={describedBy}
              onClick={() => input.current?.click()}
            >
              {photo}
            </button>
          </>
        ) : (
          <div
            className={photoClass}
            style={{ fontFamily: '"Geist Variable", sans-serif' }}
          >
            {photo}
          </div>
        )}
        <div
          id={id}
          ref={content}
          role="textbox"
          aria-labelledby={`${id}-label`}
          aria-describedby={describedBy}
          aria-readonly={!editable || busy}
          aria-invalid={invalid}
          aria-multiline="false"
          contentEditable={editable && !busy}
          suppressContentEditableWarning
          className="min-h-[4cm] outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          onInput={(event) => {
            if (!editable || busy) return;
            const html = event.currentTarget.textContent?.trim()
              ? sanitizeCvHtml(event.currentTarget.innerHTML)
              : "";
            if (event.currentTarget.innerHTML !== html)
              event.currentTarget.innerHTML = html;
            onChange?.(html);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.preventDefault();
          }}
          onPaste={(event) => {
            event.preventDefault();
            if (editable && !busy)
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
  );
}
